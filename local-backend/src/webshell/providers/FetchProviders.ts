/**
 * 网页抓取 Provider 实现
 * 支持多源聚合爬取，从配置中读取爬取源
 * 支持分页读取长文档
 */

import fetch from 'node-fetch';
import { FetchProvider } from '../types';
import { userModelRegistry, SearchProviderConfig } from '../../utils/llm/UserModelRegistry';

// ============================================
// 🔥 全局配置：分块大小（可根据需要调整）
// ============================================
// 例如：设置为 200000，则100万字会分成5块
export const CONTENT_CHUNK_SIZE = 300000; // 每块50万字符

// ============================================
// 🔥 分块内容缓存管理器
// ============================================

interface ContentChunk {
  id: string;           // 块访问ID
  content: string;      // 块内容
  index: number;        // 块序号（从0开始）
  totalChunks: number;  // 总块数
}

interface CachedDocument {
  url: string;
  title: string | undefined;
  totalLength: number;
  chunks: ContentChunk[];
  timestamp: number;
}

class ChunkedContentCache {
  private documents: Map<string, CachedDocument> = new Map();
  private chunkIdToDocKey: Map<string, string> = new Map(); // 块ID -> 文档key
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30分钟过期
  private readonly MAX_DOCUMENTS = 20; // 最多缓存20个文档
  private readonly chunkSize: number;

  constructor(chunkSize: number = CONTENT_CHUNK_SIZE) {
    this.chunkSize = chunkSize;
  }

  /**
   * 将内容分块并缓存
   * @returns 返回第一块的内容和访问信息
   */
  chunkAndCache(url: string, fullText: string, title: string, metadata: any): {
    firstChunk: string;
    chunkIds: string[];
    totalChunks: number;
    totalLength: number;
  } {
    // 清理过期文档
    this.cleanup();

    // 如果缓存满了，删除最旧的文档
    if (this.documents.size >= this.MAX_DOCUMENTS) {
      const oldestKey = this.documents.keys().next().value;
      if (oldestKey) {
        this.deleteDocument(oldestKey);
      }
    }

    // 生成文档key
    const docKey = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 分块
    const chunks: ContentChunk[] = [];
    const chunkIds: string[] = [];
    const totalLength = fullText.length;
    const totalChunks = Math.ceil(totalLength / this.chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.chunkSize;
      const end = Math.min(start + this.chunkSize, totalLength);
      const chunkContent = fullText.substring(start, end);
      const chunkId = `${docKey}_chunk_${i}`;

      chunks.push({
        id: chunkId,
        content: chunkContent,
        index: i,
        totalChunks,
      });
      chunkIds.push(chunkId);
      this.chunkIdToDocKey.set(chunkId, docKey);
    }

    // 缓存文档
    this.documents.set(docKey, {
      url,
      title,
      totalLength,
      chunks,
      timestamp: Date.now(),
    });

    console.log(`[ContentCache] 文档已分块缓存: ${totalChunks}块, 共${(totalLength / 10000).toFixed(1)}万字`);

    return {
      firstChunk: chunks[0].content,
      chunkIds,
      totalChunks,
      totalLength,
    };
  }

  /**
   * 通过块ID获取内容
   */
  getChunkById(chunkId: string): { content: string; index: number; totalChunks: number; title: string | undefined; url: string } | null {
    const docKey = this.chunkIdToDocKey.get(chunkId);
    if (!docKey) return null;

    const doc = this.documents.get(docKey);
    if (!doc) {
      this.chunkIdToDocKey.delete(chunkId);
      return null;
    }

    // 检查是否过期
    if (Date.now() - doc.timestamp > this.CACHE_TTL) {
      this.deleteDocument(docKey);
      return null;
    }

    const chunk = doc.chunks.find(c => c.id === chunkId);
    if (!chunk) return null;

    return {
      content: chunk.content,
      index: chunk.index,
      totalChunks: chunk.totalChunks,
      title: doc.title,
      url: doc.url,
    };
  }

  /**
   * 删除文档及其所有块
   */
  private deleteDocument(docKey: string): void {
    const doc = this.documents.get(docKey);
    if (doc) {
      // 删除所有块ID映射
      for (const chunk of doc.chunks) {
        this.chunkIdToDocKey.delete(chunk.id);
      }
      this.documents.delete(docKey);
    }
  }

  /**
   * 清理过期文档
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, doc] of this.documents.entries()) {
      if (now - doc.timestamp > this.CACHE_TTL) {
        this.deleteDocument(key);
      }
    }
  }
}

// 全局缓存实例（使用全局配置的分块大小）
export const contentCache = new ChunkedContentCache(CONTENT_CHUNK_SIZE);

/**
 * Firecrawl Provider
 */
export class FirecrawlFetchProvider implements FetchProvider {
  name = 'Firecrawl';
  private config: SearchProviderConfig;

  constructor(config: SearchProviderConfig) {
    this.config = config;
    this.name = config.name || 'Firecrawl';
  }

  async fetch(url: string): Promise<{ content: string; metadata: any }> {
    if (!this.config.apiKey) {
      throw new Error(`[${this.name}] API Key 未配置`);
    }

    const response: any = await fetch(this.config.url || 'https://api.firecrawl.dev/v0/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`[${this.name}] API 错误: ${await response.text()}`);
    }

    const data = await response.json();
    
    return {
      content: data.markdown || data.content || '',
      metadata: {
        title: data.metadata?.title,
        author: data.metadata?.author,
        publishedDate: data.metadata?.publishedTime,
        domain: new URL(url).hostname,
      },
    };
  }
}

/**
 * Native Fetch Provider (兜底方案)
 */
export class NativeFetchProvider implements FetchProvider {
  name = 'Native';

  // 模拟真实浏览器的 User-Agent 池
  private static USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  ];

  // 🔥 最大内容长度限制（使用全局配置）
  private static MAX_CONTENT_LENGTH = CONTENT_CHUNK_SIZE;

  async fetch(url: string): Promise<{ content: string; metadata: any }> {
    const randomUA = NativeFetchProvider.USER_AGENTS[Math.floor(Math.random() * NativeFetchProvider.USER_AGENTS.length)];
    
    const response: any = await fetch(url, {
      headers: {
        'User-Agent': randomUA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 30000, // 30秒超时
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // 🔥 检测是否是 PDF 内容
    const isPDF = html.startsWith('%PDF') || url.toLowerCase().endsWith('.pdf');

    let fullText: string;

    if (isPDF) {
      // PDF 文件：保留完整内容
      fullText = html;
    } else {
      // 网页：提取文本
      fullText = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      fullText = fullText.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      fullText = fullText.replace(/<[^>]+>/g, ' ');
      fullText = fullText.replace(/\s+/g, ' ').trim();
    }

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : (isPDF ? 'PDF文档' : '');
    const totalLength = fullText.length;

    // 🔥 如果内容超过限制，分块缓存
    if (totalLength > NativeFetchProvider.MAX_CONTENT_LENGTH) {
      const { firstChunk, chunkIds, totalChunks } = contentCache.chunkAndCache(url, fullText, title, {
        domain: new URL(url).hostname,
        isPDF,
      });

      // 构建提示信息
      let displayText = firstChunk;
      displayText += `\n\n[📄 文档共${(totalLength / 10000).toFixed(1)}万字，已分成${totalChunks}份，当前显示第1份]\n`;
      displayText += `[💡 如需阅读其他部分，请使用工具：web_url_reader，参数：{ "url": "${url}", "chunkId": "<块ID>" }]\n`;
      displayText += `[📋 所有块ID列表：${chunkIds.map((id, i) => `第${i + 1}份:${id}`).join(', ')}]`;

      return {
        content: displayText,
        metadata: {
          title,
          domain: new URL(url).hostname,
          isPDF,
          totalLength,
          totalChunks,
          currentChunk: 1,
          chunkIds, // 🔥 返回所有块ID
        },
      };
    }

    // 内容未超限，直接返回
    return {
      content: fullText,
      metadata: {
        title,
        domain: new URL(url).hostname,
        isPDF,
        totalLength,
      },
    };
  }

  /**
   * 🔥 通过块ID获取内容
   * @param chunkId 块访问ID
   */
  fetchByChunkId(chunkId: string): { content: string; metadata: any } | null {
    const chunk = contentCache.getChunkById(chunkId);
    if (!chunk) return null;

    const { content, index, totalChunks, title, url } = chunk;

    let displayText = content;
    displayText += `\n\n[📄 这是第${index + 1}/${totalChunks}份内容]`;
    if (index < totalChunks - 1) {
      displayText += `\n[💡 如需阅读下一份，请使用工具：web_url_reader，参数：{ "url": "${url}", "chunkId": "<下一块ID>" }]`;
    } else {
      displayText += `\n[✅ 已显示全部内容]`;
    }

    return {
      content: displayText,
      metadata: {
        title,
        url,
        currentChunk: index + 1,
        totalChunks,
      },
    };
  }
}

/**
 * Jina AI Reader Provider
 * https://r.jina.ai/http://URL
 */
export class JinaFetchProvider implements FetchProvider {
  name = 'Jina AI Reader';
  private config: SearchProviderConfig;

  constructor(config: SearchProviderConfig) {
    this.config = config;
    this.name = config.name || 'Jina AI Reader';
  }

  async fetch(url: string): Promise<{ content: string; metadata: any }> {
    if (!this.config.apiKey) {
      throw new Error(`[${this.name}] API Key 未配置`);
    }

    // Jina AI Reader 使用 URL 模式: https://r.jina.ai/http://example.com
    const jinaUrl = `${this.config.url}${url}`;

    const response: any = await fetch(jinaUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`[${this.name}] API 错误: ${await response.text()}`);
    }

    const data = await response.json();

    return {
      content: data.content || data.text || '',
      metadata: {
        title: data.title || '',
        url: data.url || url,
        domain: new URL(url).hostname,
      },
    };
  }
}

/**
 * 通用 HTTP Fetch Provider
 * 用于自定义爬取源
 */
export class GenericFetchProvider implements FetchProvider {
  name = 'Generic';
  private config: SearchProviderConfig;

  constructor(config: SearchProviderConfig) {
    this.config = config;
    this.name = config.name || 'Generic';
  }

  async fetch(url: string): Promise<{ content: string; metadata: any }> {
    if (!this.config.apiKey) {
      throw new Error(`[${this.name}] API Key 未配置`);
    }

    const response: any = await fetch(this.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error(`[${this.name}] API 错误: ${await response.text()}`);
    }

    const data = await response.json();

    return {
      content: data.content || data.markdown || data.text || '',
      metadata: {
        title: data.title || data.metadata?.title || '',
        domain: new URL(url).hostname,
      },
    };
  }
}

/**
 * 聚合 Fetch Provider
 * 从配置中读取所有 fetch 源，进行随机选择和聚合
 */
export class AggregateFetchProvider implements FetchProvider {
  name = 'AggregateFetch';
  private providers: FetchProvider[] = [];
  private currentUserId: string | null = null;

  constructor(userId?: string) {
    this.currentUserId = userId || null;
    this.loadProvidersFromConfig();
  }

  /**
   * 设置当前用户ID并重新加载爬取源
   */
  setUserId(userId: string): void {
    if (this.currentUserId !== userId) {
      console.log(`[AggregateFetch] 切换用户: ${this.currentUserId || 'null'} -> ${userId}`);
      this.currentUserId = userId;
      this.loadProvidersFromConfig();
    }
  }

  /**
   * 从配置加载 fetch 源
   * 根据 providerType 选择对应的 Provider 实现
   * 🔥 使用 getFetchProviderConfig 获取配置，与 UrlReaderService 保持一致
   */
  private loadProvidersFromConfig(): void {
    // 🔥 拒绝 default 用户或空用户
    if (!this.currentUserId || this.currentUserId === 'default') {
      console.warn(`[AggregateFetch] 拒绝为未登录用户加载爬取源`);
      // 只保留 Native 作为兜底
      this.providers = [new NativeFetchProvider()];
      return;
    }

    try {
      // 🔥 设置当前用户，确保加载正确的用户配置
      userModelRegistry.setCurrentUser(this.currentUserId);
      
      this.providers = [];
      
      // 🔥 使用 getFetchProviderConfig 获取配置（与 UrlReaderService 一致）
      const firecrawlConfig = userModelRegistry.getFetchProviderConfig('firecrawl');
      console.log(`[AggregateFetch] Firecrawl 配置:`, firecrawlConfig ? {
        hasApiKey: !!firecrawlConfig.apiKey,
        apiKeyPrefix: firecrawlConfig.apiKey?.substring(0, 10) + '...',
        url: firecrawlConfig.url
      } : '未找到');
      if (firecrawlConfig?.apiKey) {
        this.providers.push(new FirecrawlFetchProvider(firecrawlConfig));
        console.log('[AggregateFetch] Firecrawl 已加载');
      }

      const jinaConfig = userModelRegistry.getFetchProviderConfig('jina');
      if (jinaConfig?.apiKey) {
        this.providers.push(new JinaFetchProvider(jinaConfig));
        console.log('[AggregateFetch] Jina 已加载');
      }

      // 总是添加 Native 作为兜底
      this.providers.push(new NativeFetchProvider());

      console.log(`[AggregateFetch] 已加载 ${this.providers.length} 个爬取源 (用户: ${this.currentUserId})`);
    } catch (error) {
      console.error('[AggregateFetch] 加载爬取源失败:', error);
      // 至少保留 Native
      this.providers = [new NativeFetchProvider()];
    }
  }

  /**
   * 随机打乱数组
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async fetch(url: string, userId?: string): Promise<{ content: string; metadata: any }> {
    // 🔥 如果传入了 userId，切换到对应用户
    if (userId) {
      this.setUserId(userId);
    }
    
    // 🔥 只在第一次或providers为空时加载配置
    if (this.providers.length === 0) {
      this.loadProvidersFromConfig();
    }

    if (this.providers.length === 0) {
      throw new Error('[AggregateFetch] 没有可用的爬取源');
    }

    // 随机打乱顺序，实现负载均衡
    const shuffledProviders = this.shuffleArray(this.providers);

    let lastError: Error | null = null;

    for (const provider of shuffledProviders) {
      try {
        console.log(`[AggregateFetch] 尝试使用 ${provider.name}`);
        const result = await provider.fetch(url);
        console.log(`[AggregateFetch] ${provider.name} 成功`);
        return result;
      } catch (error) {
        console.warn(`[AggregateFetch] ${provider.name} 失败:`, error);
        lastError = error as Error;
        continue;
      }
    }

    throw lastError || new Error('[AggregateFetch] 所有爬取源均失败');
  }

  /**
   * 获取当前可用的爬取源数量
   */
  getProviderCount(): number {
    return this.providers.length;
  }
}

/**
 * 容错 Fetch Provider (自动降级)
 * 兼容旧版本接口
 */
export class FallbackFetchProvider implements FetchProvider {
  name = 'Fallback';
  private aggregateProvider: AggregateFetchProvider;

  constructor(_providers?: FetchProvider[]) {
    this.aggregateProvider = new AggregateFetchProvider();
  }

  async fetch(url: string): Promise<{ content: string; metadata: any }> {
    return this.aggregateProvider.fetch(url);
  }
}

/**
 * 创建聚合 Fetch Provider 的工厂函数
 */
export function createAggregateFetchProvider(): AggregateFetchProvider {
  return new AggregateFetchProvider();
}
