/**
 * 🔥 知识库检索服务
 * 根据用户查询检索相关知识库内容
 */

import { useGuideKnowledgeBase, KnowledgeItem } from './useGuideData';
import { dynamicKnowledgeBase, DynamicKnowledgeItem } from './dynamicKnowledge';

// 🔥 知识库检索默认参数（集中配置）
export const KNOWLEDGE_SEARCH_DEFAULTS = {
  topK: 1,        // 默认返回 1 个最匹配结果
  minScore: 0.3,  // 默认最低匹配分数
};

export interface SearchResult {
  /** 匹配的知识项 */
  item: KnowledgeItem | DynamicKnowledgeItem;
  /** 匹配分数 (0-1) */
  score: number;
  /** 匹配原因 */
  matchReason: string;
}

export interface KnowledgeSearchOptions {
  /** 返回结果数量 */
  topK?: number;
  /** 最低匹配分数阈值 */
  minScore?: number;
  /** 指定分类筛选 */
  category?: KnowledgeItem['category'];
}

/**
 * 知识库检索服务
 */
export class KnowledgeBaseService {
  private staticKnowledge: KnowledgeItem[];
  private dynamicKnowledge: DynamicKnowledgeItem[];

  constructor() {
    this.staticKnowledge = useGuideKnowledgeBase;
    this.dynamicKnowledge = dynamicKnowledgeBase;
  }

  private getAllKnowledge(): (KnowledgeItem | DynamicKnowledgeItem)[] {
    return [...this.staticKnowledge, ...this.dynamicKnowledge];
  }

  /**
   * 搜索相关知识
   * @param userQuery 用户查询
   * @param options 搜索选项
   * @returns 匹配的知识项列表
   */
  search(userQuery: string, options: KnowledgeSearchOptions = {}): SearchResult[] {
    const { topK = KNOWLEDGE_SEARCH_DEFAULTS.topK, minScore = KNOWLEDGE_SEARCH_DEFAULTS.minScore, category } = options;

    const query = userQuery.toLowerCase().trim();
    const queryWords = this.extractKeywords(query);

    const results: SearchResult[] = this.getAllKnowledge()
      .filter(item => !category || item.category === category)
      .map(item => {
        const score = this.calculateScore(query, queryWords, item);
        return {
          item,
          score,
          matchReason: this.getMatchReason(query, item)
        };
      })
      .filter(result => result.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return results;
  }

  /**
   * 快速搜索 - 返回格式化的知识文本
   * @param userQuery 用户查询
   * @param options 搜索选项
   * @returns 格式化的知识文本
   */
  searchAsText(userQuery: string, options: KnowledgeSearchOptions = {}): string {
    const results = this.search(userQuery, options);

    results.forEach((r, i) => {
      const desc = 'question' in r.item ? r.item.question.substring(0, 30) : r.item.content.substring(0, 30);
    });

    if (results.length === 0) {
      return '';
    }

    const sections = results.map((result, index) => {
      if ('question' in result.item) {
        return `[${index + 1}] Q: ${result.item.question}\nA: ${result.item.answer}`;
      } else {
        return `[${index + 1}] 💡 经验: ${result.item.content}`;
      }
    });

    return sections.join('\n\n');
  }

  /**
   * 计算匹配分数
   */
  private calculateScore(query: string, queryWords: string[], item: KnowledgeItem | DynamicKnowledgeItem): number {
    let score = 0;

    if ('question' in item) {
      const questionLower = item.question.toLowerCase();
      const answerLower = item.answer.toLowerCase();

      if (query.includes(questionLower)) {
        score += 1.0;
      }

      const matchedKeywords = item.keywords.filter(kw => {
        const kwLower = kw.toLowerCase();
        return query.includes(kwLower);
      });
      score += matchedKeywords.length * 0.6;

      const coreConcepts = queryWords.filter(qw => qw.length >= 4);
      for (const concept of coreConcepts) {
        if (questionLower.includes(concept)) {
          score += 0.25;
        }
        if (answerLower.includes(concept)) {
          score += 0.1;
        }
      }
    } else {
      const contentLower = item.content.toLowerCase();

      if (query.includes(contentLower) || contentLower.includes(query)) {
        score += 1.0;
      }

      const coreConcepts = queryWords.filter(qw => qw.length >= 4);
      for (const concept of coreConcepts) {
        if (contentLower.includes(concept)) {
          score += 0.3;
        }
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    // 简单的中文分词：按字符和常见词提取
    const stopWords = new Set(['的', '了', '是', '我', '你', '他', '她', '它', '们', '这', '那', '有', '在', '吗', '呢', '吧', '啊', '哦', '嗯']);

    // 提取2-4个字的词组
    const words: string[] = [];
    for (let i = 0; i < text.length; i++) {
      for (let len = 2; len <= 4 && i + len <= text.length; len++) {
        const word = text.substring(i, i + len);
        if (!word.split('').some(c => stopWords.has(c))) {
          words.push(word);
        }
      }
    }

    // 同时保留单字（非停用词）
    text.split('').forEach(c => {
      if (!stopWords.has(c) && c.length === 1 && /[\u4e00-\u9fa5a-zA-Z0-9]/.test(c)) {
        words.push(c);
      }
    });

    return [...new Set(words)];
  }

  /**
   * 获取匹配原因
   */
  private getMatchReason(query: string, item: KnowledgeItem | DynamicKnowledgeItem): string {
    const reasons: string[] = [];

    if ('question' in item) {
      if (item.question.toLowerCase().includes(query)) {
        reasons.push('问题匹配');
      }

      const matchedKeywords = item.keywords.filter(kw =>
        query.includes(kw.toLowerCase())
      );
      if (matchedKeywords.length > 0) {
        reasons.push(`关键词: ${matchedKeywords.join(', ')}`);
      }
    } else {
      if (item.content.toLowerCase().includes(query) || query.includes(item.content.toLowerCase())) {
        reasons.push('内容匹配');
      }
    }

    return reasons.join('; ') || '内容相关';
  }

  /**
   * 按分类获取知识
   */
  getKnowledgeByCategory(category: KnowledgeItem['category'] | DynamicKnowledgeItem['category']): (KnowledgeItem | DynamicKnowledgeItem)[] {
    return this.getAllKnowledge().filter(item => item.category === category);
  }

  addDynamicKnowledge(item: DynamicKnowledgeItem): void {
    this.dynamicKnowledge.push(item);
  }
}

// 导出单例实例
export const knowledgeBaseService = new KnowledgeBaseService();
