/**
 * CallMemoryTool - 记忆召回工具
 *
 * 功能：
 * 1. 接收自然语言查询
 * 2. 提取核心搜索词（保护标识符、中文词组）
 * 3. 通过 FTS5 全文搜索 message 表
 * 4. 短语匹配优先 + 时间衰减得分
 * 5. 命中后还原上下文（上下各抓5条）
 * 6. 返回 top2 场景
 */

import { ToolApiClient } from '@/utils/ToolApiClient';

// ============================================================================
// 配置常量
// ============================================================================

const STOP_WORDS = new Set([
  // 中文停用词
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很',
  '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '那', '之', '与', '及',
  '或', '但', '而', '因', '于', '把', '被', '让', '向', '从', '对', '给', '为', '以', '可', '能',
  '来', '过', '下', '中', '大', '小', '多', '少', '个', '种', '里', '外', '前', '后', '内', '间',
  '请', '谢谢', '帮忙', '一下', '需要', '想要', '知道', '怎么', '什么', '哪里', '为什么', '如何',
  // 英文基础停用词（保留 URL、download、upload、oss 等关键词）
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
  'does', 'did', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'shall',
  // 常见噪声词（保留 file、link、report 等可能出现在 URL 中的词）
  'use', 'test', 'testing', 'next', 'round', 'operation', 'operate', 'action', 'step', 'run',
  'execute', 'perform', 'make', 'get', 'go', 'try', 'check', 'look', 'see', 'find', 'search',
  'query', 'call', 'invoke', 'start', 'begin', 'end', 'finish', 'done', 'ok', 'yes', 'no',
  'help', 'please', 'want', 'need', 'like', 'think', 'know', 'mean', 'say', 'tell', 'ask',
  'computer', 'tool', 'function', 'method', 'api', 'app', 'application', 'system', 'code',
  'folder', 'path', 'dir', 'directory', 'project', 'workspace', 'task', 'job',
  'work', 'working', 'now', 'then', 'here', 'there', 'today', 'yesterday', 'tomorrow',
  'again', 'also', 'still', 'already', 'just', 'only', 'even', 'very', 'really', 'actually',
  'maybe', 'perhaps', 'probably', 'definitely', 'certainly', 'sure', 'right', 'well',
  'good', 'great', 'nice', 'fine', 'bad', 'wrong', 'error', 'issue', 'problem', 'bug',
  'fix', 'solve', 'resolved', 'done', 'complete', 'completed', 'finish', 'finished',
]);

const PHRASE_MATCH_BONUS = 2.5;
const IDENTIFIER_MATCH_BONUS = 3.0;

// 时间衰减：半衰期 7 天
const TIME_DECAY_HALF_LIFE_DAYS = 7;
const TIME_DECAY_LAMBDA = Math.log(2) / (TIME_DECAY_HALF_LIFE_DAYS * 24 * 60 * 60 * 1000);

// 上下文抓取条数
const CONTEXT_BEFORE = 5;
const CONTEXT_AFTER = 5;

// 最终返回场景数
const TOP_SCENES = 2;

// ============================================================================
// 类型定义
// ============================================================================

interface SearchHit {
  messageId: string;
  conversationId: string;
  conversationTitle: string | null;
  role: string;
  content: string;
  snippet: string;
  createdAt: string;
  baseScore: number;
  matchedToken: string;
  sessionId?: string;
}

interface MemoryScene {
  sceneIndex: number;
  hitMessage: SearchHit;
  contextMessages: Array<{ role: string; content: string; createdAt: string }>;
  combinedScore: number;
}

export interface UnifiedSearchResult {
  source: 'memory';
  content: string;
  relevanceScore: number;
  metadata?: Record<string, any>;
}

export interface CallMemoryRequest {
  query: string;
  userId: string;
  conversationId?: string;
  sessionId?: string;
}

export interface CallMemoryResponse {
  success: boolean;
  results: UnifiedSearchResult[];
  totalCount: number;
  error?: string;
}

// ============================================================================
// 查询解析
// ============================================================================

interface SearchToken {
  text: string;
  type: 'identifier' | 'phrase' | 'word';
  weight: number;
}

function extractIdentifiers(text: string): string[] {
  // 🔥 匹配带下划线的标识符（如 tsmc_2025_2027）
  const underscoreMatches = text.match(/[a-zA-Z0-9_]+(?:_[a-zA-Z0-9_]+)+/g) || [];
  
  // 🔥 匹配大写缩写词（如 TSMC、OSS、URL、HTML）
  const acronymMatches = text.match(/[A-Z]{2,6}/g) || [];
  
  // 🔥 合并并去重
  return [...new Set([...underscoreMatches, ...acronymMatches])];
}

function extractChinesePhrases(text: string): string[] {
  const phrases: string[] = [];
  const chineseSeq = text.match(/[\u4e00-\u9fa5]{2,6}/g);
  if (chineseSeq) {
    chineseSeq.forEach(seq => {
      for (let i = 0; i < seq.length; i++) {
        for (let len = 2; len <= Math.min(4, seq.length - i); len++) {
          phrases.push(seq.slice(i, i + len));
        }
      }
    });
  }
  return [...new Set(phrases)];
}

function parseQuery(query: string): SearchToken[] {
  const tokens: SearchToken[] = [];
  const seen = new Set<string>();

  const identifiers = extractIdentifiers(query);
  identifiers.forEach(id => {
    if (!seen.has(id)) {
      seen.add(id);
      tokens.push({ text: id, type: 'identifier', weight: IDENTIFIER_MATCH_BONUS });
    }
  });

  const phrases = extractChinesePhrases(query);
  phrases.forEach(ph => {
    if (!seen.has(ph) && !STOP_WORDS.has(ph)) {
      seen.add(ph);
      tokens.push({ text: ph, type: 'phrase', weight: PHRASE_MATCH_BONUS });
    }
  });

  const words: string[] = query.match(/[a-zA-Z][a-zA-Z0-9]{2,}/g) || [];
  words.forEach(w => {
    const lower = w.toLowerCase();
    if (!seen.has(lower) && !STOP_WORDS.has(lower) && !identifiers.includes(w)) {
      seen.add(lower);
      // 英文单词长度越短权重越低，避免短词噪声
      const lengthBoost = Math.min(lower.length / 5, 1.0);
      tokens.push({ text: w, type: 'word', weight: 1.0 * lengthBoost });
    }
  });

  const cleanQuery = query.replace(/[.,;:"'`~^*+=<>@#&|!?()\[\]{}\\/$%_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleanQuery.length >= 4 && !seen.has(cleanQuery)) {
    tokens.unshift({ text: cleanQuery, type: 'phrase', weight: PHRASE_MATCH_BONUS * 1.2 });
  }

  return tokens;
}

function escapeFts5(keyword: string): string {
  if (!keyword) return '';
  const specialChars = /[.,;:"'`~^*+=<>@#&|!?()\[\]{}\\/$%-]+/g;
  return keyword.replace(specialChars, ' ').replace(/\s+/g, ' ').trim();
}

// ============================================================================
// 时间衰减
// ============================================================================

function applyTimeDecay(baseScore: number, createdAt: string): number {
  const msgTime = new Date(createdAt).getTime();
  const now = Date.now();
  const ageMs = now - msgTime;
  if (ageMs <= 0) return baseScore;

  const decayFactor = Math.exp(-TIME_DECAY_LAMBDA * ageMs);
  return baseScore * decayFactor;
}

// ============================================================================
// 主类
// ============================================================================

export class CallMemoryTool {
  private static instance: CallMemoryTool;

  static getInstance(): CallMemoryTool {
    if (!CallMemoryTool.instance) {
      CallMemoryTool.instance = new CallMemoryTool();
    }
    return CallMemoryTool.instance;
  }

  async callMemory(request: CallMemoryRequest): Promise<CallMemoryResponse> {
    const { query, userId, conversationId, sessionId } = request;

    // 🔥 如果提供了 sessionId，直接返回该 Session 的完整消息
    if (sessionId && conversationId) {
      return this.getSessionMessages(conversationId, sessionId);
    }

    console.log('🧠 [CallMemoryTool] 开始搜索:', { query, userId, conversationId });

    if (!query || query.trim().length === 0) {
      return {
        success: false,
        results: [],
        totalCount: 0,
        error: '请提供搜索关键词（query参数）',
      };
    }

    try {
      const tokens = parseQuery(query);
      console.log('🧠 [CallMemoryTool] 解析token:', tokens.map(t => `${t.text}(${t.type},w=${t.weight})`));

      if (tokens.length === 0) {
        return {
          success: true,
          results: [],
          totalCount: 0,
          error: `无法从 "${query}" 中提取有效搜索词`,
        };
      }

      // 🔥 策略1: 优先用整句搜索（最符合人类记忆方式）
      let hits = await this.searchWholeQuery(query, userId, conversationId);
      console.log('🧠 [CallMemoryTool] 整句搜索命中:', hits.length, '条');

      // 🔥 策略2: 整句搜不到，才拆词搜索
      if (hits.length === 0) {
        hits = await this.searchHits(tokens, userId, conversationId);
        console.log('🧠 [CallMemoryTool] 拆词搜索命中:', hits.length, '条');
      }

      if (hits.length === 0) {
        return {
          success: true,
          results: [],
          totalCount: 0,
          error: `未找到与 "${query}" 相关的历史记录`,
        };
      }

      // 应用时间衰减
      const scoredHits = hits.map(hit => ({
        ...hit,
        finalScore: applyTimeDecay(hit.baseScore, hit.createdAt),
      })).sort((a, b) => b.finalScore - a.finalScore);

      console.log('🧠 [CallMemoryTool] 衰减后 top5:', scoredHits.slice(0, 5).map(h => ({
        score: h.finalScore.toFixed(3),
        token: h.matchedToken,
        age: Math.round((Date.now() - new Date(h.createdAt).getTime()) / (24 * 3600 * 1000)) + '天',
      })));

      // 取 top 命中，还原上下文，构建场景
      const scenes = await this.buildScenes(scoredHits, TOP_SCENES);

      const results: UnifiedSearchResult[] = scenes.map((scene, idx) => ({
        source: 'memory',
        content: this.formatScene(scene),
        relevanceScore: scene.combinedScore,
        metadata: {
          sceneIndex: idx + 1,
          conversationId: scene.hitMessage.conversationId,
          conversationTitle: scene.hitMessage.conversationTitle,
          hitMessageId: scene.hitMessage.messageId,
          hitRole: scene.hitMessage.role,
          matchedToken: scene.hitMessage.matchedToken,
          sessionId: scene.hitMessage.sessionId,
          contextCount: scene.contextMessages.length,
        },
      }));

      console.log('✅ [CallMemoryTool] 返回场景:', results.length);

      return {
        success: true,
        results,
        totalCount: results.length,
      };

    } catch (error) {
      console.error('❌ [CallMemoryTool] 搜索失败:', error);
      return {
        success: false,
        results: [],
        totalCount: 0,
        error: error instanceof Error ? error.message : '搜索失败',
      };
    }
  }

  /**
   * 🔥 策略1: 整句搜索（优先）
   * 直接用用户的原始 query 去 FTS5 搜索，让 BM25 算相关性
   */
  private async searchWholeQuery(
    query: string,
    userId: string,
    conversationId?: string
  ): Promise<SearchHit[]> {
    const cleaned = escapeFts5(query);
    if (!cleaned || cleaned.length < 3) return [];

    try {
      const searchResult = await ToolApiClient.memory.search({
        keyword: cleaned,
        userId,
        conversationId,
        limit: 20,
      });

      const data = searchResult?.data || searchResult?.results || [];
      const hits: SearchHit[] = [];

      data.forEach((m: any) => {
        const messageId = m.id || m.messageId;
        if (!messageId) return;

        // 整句搜索的得分直接用 FTS5 的 rank（BM25），越小越相关
        // FTS5 rank 是 BM25 分数，值越小表示越相关
        // 转换为正分数：rank 越小，分数越高
        const rawRank = m.rank ?? 0;
        // 🔥 使用 1/(1+|rank|) 转换，确保 rank 越小分数越高，且分数在 0-1 之间
        const baseScore = rawRank === 0 ? 1.0 : 1 / (1 + Math.abs(rawRank));

        hits.push({
          messageId,
          conversationId: m.conversation_id || m.conversationId,
          conversationTitle: m.conversation_title || m.conversationTitle,
          role: m.role,
          content: m.content || '',
          snippet: m.snippet || m.content?.substring(0, 200) || '',
          createdAt: m.created_at || m.createdAt,
          baseScore,
          matchedToken: query,
          sessionId: m.session_id || m.sessionId,
        });
      });

      return hits;
    } catch (e) {
      console.warn('⚠️ [CallMemoryTool] 整句搜索失败:', query, e);
      return [];
    }
  }

  /**
   * 🔥 策略2: 拆词搜索（降级）
   * 整句搜不到时，拆成 token 分别搜索
   */
  private async searchHits(
    tokens: SearchToken[],
    userId: string,
    conversationId?: string
  ): Promise<SearchHit[]> {
    const seenIds = new Set<string>();
    const hits: SearchHit[] = [];
    const sortedTokens = [...tokens].sort((a, b) => b.weight - a.weight);

    // 🔥 分离高权重 token（必须全部搜索）和低权重 token（可跳过）
    const highWeightTokens = sortedTokens.filter(t => t.type === 'identifier' || t.type === 'phrase');
    const lowWeightTokens = sortedTokens.filter(t => t.type === 'word');

    // 🔥 先搜索所有高权重 token（identifier 和 phrase 必须全部搜索）
    for (const token of highWeightTokens) {
      const escaped = escapeFts5(token.text);
      if (!escaped || escaped.length < 2) continue;

      try {
        const phraseKeyword = `"${escaped}"`;

        const searchResult = await ToolApiClient.memory.search({
          keyword: phraseKeyword,
          userId,
          conversationId,
          limit: 15,
        });

        const data = searchResult?.data || searchResult?.results || [];

        data.forEach((m: any) => {
          const messageId = m.id || m.messageId;
          if (!messageId || seenIds.has(messageId)) return;

          seenIds.add(messageId);

          const rawRank = m.rank ?? 0;
          const rankScore = rawRank === 0 ? 1.0 : 1 / (1 + Math.abs(rawRank));
          const baseScore = rankScore * token.weight;
          const lengthFactor = Math.min(token.text.length / 3, 2.0);

          hits.push({
            messageId,
            conversationId: m.conversation_id || m.conversationId,
            conversationTitle: m.conversation_title || m.conversationTitle,
            role: m.role,
            content: m.content || '',
            snippet: m.snippet || m.content?.substring(0, 200) || '',
            createdAt: m.created_at || m.createdAt,
            baseScore: baseScore * lengthFactor,
            matchedToken: token.text,
            sessionId: m.session_id || m.sessionId,
          });
        });

      } catch (e) {
        console.warn('⚠️ [CallMemoryTool] token搜索失败:', token.text, e);
      }
    }

    // 🔥 如果高权重 token 找到足够结果，跳过低权重 token
    if (hits.length >= 20) {
      console.log('🧠 [CallMemoryTool] 高权重 token 已找到足够结果，跳过低权重 token');
      return hits;
    }

    // 🔥 搜索低权重 token（word 类型）
    for (const token of lowWeightTokens) {
      const escaped = escapeFts5(token.text);
      if (!escaped || escaped.length < 2) continue;

      try {
        const searchResult = await ToolApiClient.memory.search({
          keyword: escaped,
          userId,
          conversationId,
          limit: 15,
        });

        const data = searchResult?.data || searchResult?.results || [];

        data.forEach((m: any) => {
          const messageId = m.id || m.messageId;
          if (!messageId || seenIds.has(messageId)) return;

          seenIds.add(messageId);

          const rawRank = m.rank ?? 0;
          const rankScore = rawRank === 0 ? 1.0 : 1 / (1 + Math.abs(rawRank));
          const baseScore = rankScore * token.weight;
          const lengthFactor = Math.min(token.text.length / 3, 2.0);

          hits.push({
            messageId,
            conversationId: m.conversation_id || m.conversationId,
            conversationTitle: m.conversation_title || m.conversationTitle,
            role: m.role,
            content: m.content || '',
            snippet: m.snippet || m.content?.substring(0, 200) || '',
            createdAt: m.created_at || m.createdAt,
            baseScore: baseScore * lengthFactor,
            matchedToken: token.text,
            sessionId: m.session_id || m.sessionId,
          });
        });

        if (hits.length >= 30) break;

      } catch (e) {
        console.warn('⚠️ [CallMemoryTool] token搜索失败:', token.text, e);
      }
    }

    return hits;
  }

  private async buildScenes(
    scoredHits: Array<SearchHit & { finalScore: number }>,
    maxScenes: number
  ): Promise<MemoryScene[]> {
    const scenes: MemoryScene[] = [];
    const usedMessageIds = new Set<string>();

    for (const hit of scoredHits) {
      if (scenes.length >= maxScenes) break;
      if (usedMessageIds.has(hit.messageId)) continue;

      try {
        const ctxResult = await ToolApiClient.memory.getContext({
          conversationId: hit.conversationId,
          messageId: hit.messageId,
          before: CONTEXT_BEFORE,
          after: CONTEXT_AFTER,
        });

        const ctxData = ctxResult?.data || [];
        const contextMessages = ctxData.map((m: any) => ({
          role: m.role,
          content: (m.content || '').substring(0, 800),  // 🔥 增加截断长度，确保 URL 不被截断
          createdAt: m.created_at || m.createdAt,
        }));

        // 标记该场景涉及的消息为已使用（避免重复场景）
        contextMessages.forEach((m: any, idx: number) => {
          if (ctxData[idx]?.id) usedMessageIds.add(ctxData[idx].id);
        });

        scenes.push({
          sceneIndex: scenes.length + 1,
          hitMessage: hit,
          contextMessages,
          combinedScore: hit.finalScore,
        });

      } catch (e) {
        console.warn('⚠️ [CallMemoryTool] 获取上下文失败:', hit.messageId, e);
        // 没有上下文也作为一个场景
        scenes.push({
          sceneIndex: scenes.length + 1,
          hitMessage: hit,
          contextMessages: [],
          combinedScore: hit.finalScore * 0.7,
        });
      }
    }

    return scenes.sort((a, b) => b.combinedScore - a.combinedScore);
  }

  private formatScene(scene: MemoryScene): string {
    const parts: string[] = [];

    parts.push(`【场景 ${scene.sceneIndex}】对话: ${scene.hitMessage.conversationTitle || '未命名对话'}`);
    parts.push(`命中关键词: "${scene.hitMessage.matchedToken}"`);
    if (scene.hitMessage.sessionId) {
      parts.push(`SessionId: ${scene.hitMessage.sessionId}`);
    }
    parts.push('');

    if (scene.contextMessages.length > 0) {
      parts.push('--- 上下文 ---');
      scene.contextMessages.forEach(msg => {
        const roleLabel = msg.role === 'user' ? '用户' : msg.role === 'assistant' ? '助手' : msg.role;
        parts.push(`${roleLabel}: ${msg.content}`);
      });
      parts.push('--- 命中消息 ---');
    }

    const hitRole = scene.hitMessage.role === 'user' ? '用户' : scene.hitMessage.role === 'assistant' ? '助手' : scene.hitMessage.role;
    parts.push(`${hitRole}: ${scene.hitMessage.snippet || scene.hitMessage.content.substring(0, 800)}`);  // 🔥 增加截断长度，确保 URL 不被截断

    return parts.join('\n');
  }

  /**
   * 🔥 获取指定 Session 的完整消息列表
   */
  private async getSessionMessages(
    conversationId: string,
    sessionId: string
  ): Promise<CallMemoryResponse> {
    console.log('🧠 [CallMemoryTool] 获取 Session 消息:', { conversationId, sessionId });

    try {
      const result = await ToolApiClient.memory.getSession({ conversationId, sessionId });
      const messages = result?.data || [];

      if (messages.length === 0) {
        return {
          success: true,
          results: [],
          totalCount: 0,
          error: `未找到 Session "${sessionId}" 的消息`,
        };
      }

      // 按时间排序，格式化为对话历史
      const sorted = messages.sort((a: any, b: any) =>
        new Date(a.created_at || a.createdAt).getTime() - new Date(b.created_at || b.createdAt).getTime()
      );

      const lines = sorted.map((m: any) => {
        const role = m.role === 'user' ? '用户' : m.role === 'assistant' ? '助手' : m.role;
        const content = (m.content || '').substring(0, 1000);  // 🔥 增加截断长度，确保 URL 不被截断
        return `${role}: ${content}`;
      });

      const content = [
        `【Session ${sessionId} 完整消息】共 ${messages.length} 条`,
        '',
        ...lines,
      ].join('\n');

      return {
        success: true,
        results: [{
          source: 'memory',
          content,
          relevanceScore: 1.0,
          metadata: {
            type: 'session',
            sessionId,
            conversationId,
            messageCount: messages.length,
          },
        }],
        totalCount: 1,
      };

    } catch (error) {
      console.error('❌ [CallMemoryTool] 获取 Session 消息失败:', error);
      return {
        success: false,
        results: [],
        totalCount: 0,
        error: error instanceof Error ? error.message : '获取 Session 消息失败',
      };
    }
  }
}

export const callMemoryTool = CallMemoryTool.getInstance();

export async function executeCallMemoryTool(
  step: any,
  sessionIdParam: string,
  context: { userId: string; conversationId: string }
): Promise<any> {
  const params = step.toolParams || {};
  const query = params.query || params.keyword || '';
  const sessionId = params.sessionId || undefined;

  const result = await callMemoryTool.callMemory({
    query,
    userId: context.userId,
    conversationId: context.conversationId,
    sessionId,
  });

  return {
    success: result.success,
    data: result.results,
    error: result.error,
  };
}
