/**
 * 搜索引擎 Provider 实现
 * 支持多源聚合搜索，从配置中读取搜索源
 * 支持可配置的搜索策略
 */

import fetch from 'node-fetch';
import { SearchProvider, SearchResult } from '../types';
import { userModelRegistry, SearchProviderConfig } from '../../utils/llm/UserModelRegistry';

// ============================================
// 搜索策略配置系统
// ============================================

/**
 * 搜索策略规则
 */
export interface SearchStrategyRule {
  /** 规则名称 */
  name: string;
  /** 规则描述 */
  description?: string;
  /** 
   * 匹配条件
   * - keywords: 查询中包含这些关键词时匹配
   * - domains: 结果域名匹配时优先
   * - providerTypes: 指定的搜索源类型
   */
  match?: {
    /** 关键词匹配（查询中包含任意一个即匹配） */
    keywords?: string[];
    /** 域名匹配（结果域名包含任意一个即匹配） */
    domains?: string[];
    /** 正则表达式匹配查询 */
    queryPattern?: string;
  };
  /** 
   * 搜索源优先级配置
   * - priority: 优先级列表，排在前面的优先使用
   * - fallback: 如果优先源失败，是否使用其他源
   * - exclusive: 是否只使用指定的源（不混合其他源）
   */
  providerConfig: {
    /** 搜索源类型优先级列表，如 ['tavily', 'qwen', 'serpapi'] */
    priority: string[];
    /** 是否只使用指定的源（独占模式） */
    exclusive?: boolean;
    /** 如果优先源失败，是否回退到其他源 */
    fallback?: boolean;
    /** 配额分配比例，如 { tavily: 0.6, qwen: 0.4 } */
    quotaRatio?: Record<string, number>;
  };
}

/**
 * 默认搜索策略配置
 */
export const DEFAULT_SEARCH_STRATEGIES: SearchStrategyRule[] = [
  // 🔥 注意：策略按数组顺序匹配，更具体的策略应该放在前面
  {
    name: '学术论文深度搜索',
    description: '专门搜索 arXiv 等学术资源（高优先级）',
    match: {
      keywords: ['arxiv', 'research paper', 'publication', 'journal', 'conference', 'neural network', 'machine learning', 'deep learning', 'computer vision', 'nlp', '自然语言处理', '计算机视觉'],
      domains: ['arxiv.org', 'scholar.google.com', 'ieee.org', 'acm.org', 'neurips.cc', 'icml.cc', 'iclr.cc', 'aclweb.org'],
    },
    providerConfig: {
      priority: ['arxiv', 'tavily', 'serpapi'],
      fallback: true,
      quotaRatio: { arxiv: 0.8, tavily: 0.15, serpapi: 0.05 },
    },
  },
  {
    name: 'AI模型搜索',
    description: '搜索 HuggingFace 上的开源模型、transformers、神经网络等',
    match: {
      keywords: ['huggingface', 'transformer', 'model', '神经网络', '深度学习', 'pytorch', 'tensorflow', 'bert', 'gpt', 'llm', '大模型', '预训练', 'fine-tune', '微调'],
      domains: ['huggingface.co', 'github.com/huggingface', 'pytorch.org', 'tensorflow.org'],
    },
    providerConfig: {
      priority: ['huggingface', 'tavily'],
      fallback: true,
      quotaRatio: { huggingface: 0.9, tavily: 0.1 },
    },
  },
  {
    name: '社交媒体搜索',
    description: '搜索 Twitter/X、Reddit 等社交媒体内容时优先使用 Tavily',
    match: {
      keywords: ['twitter', 'x.com', 'reddit', 'tweet', '社交媒体', 'social media'],
      domains: ['twitter.com', 'x.com', 'reddit.com', 't.co'],
    },
    providerConfig: {
      priority: ['tavily', 'qwen'],
      fallback: true,
      quotaRatio: { tavily: 0.7, qwen: 0.3 },
    },
  },
  {
    name: '学术搜索',
    description: '搜索一般学术论文、研究内容',
    match: {
      keywords: ['论文', '学术', 'research', 'paper', 'scholar', 'study'],
      domains: ['scholar.google.com', 'researchgate.net', 'ieee.org', 'acm.org'],
    },
    providerConfig: {
      priority: ['arxiv', 'tavily', 'serpapi'],
      fallback: true,
      quotaRatio: { arxiv: 0.6, tavily: 0.3, serpapi: 0.1 },
    },
  },
  {
    name: '新闻搜索',
    description: '搜索新闻内容',
    match: {
      keywords: ['新闻', 'news', 'latest', 'breaking'],
      domains: ['news.', 'bbc.com', 'cnn.com', 'reuters.com', 'apnews.com'],
    },
    providerConfig: {
      priority: ['qwen', 'tavily', 'bing'],
      fallback: true,
    },
  },
  {
    name: '技术文档搜索',
    description: '搜索技术文档、GitHub 等',
    match: {
      keywords: ['github', 'stackoverflow', 'docs', 'documentation', 'api'],
      domains: ['github.com', 'stackoverflow.com', 'docs.', 'developer.'],
    },
    providerConfig: {
      priority: ['tavily', 'bing', 'serpapi'],
      fallback: true,
    },
  },
];

/**
 * 搜索策略管理器
 */
export class SearchStrategyManager {
  private strategies: SearchStrategyRule[];

  constructor(strategies: SearchStrategyRule[] = DEFAULT_SEARCH_STRATEGIES) {
    this.strategies = strategies;
  }

  /**
   * 根据查询选择匹配的搜索策略
   */
  selectStrategy(query: string): SearchStrategyRule | null {
    const lowerQuery = query.toLowerCase();

    console.log(`[SearchStrategy] 尝试匹配策略，查询: "${query}"，已加载 ${this.strategies.length} 个策略`);

    for (const strategy of this.strategies) {
      const match = strategy.match;
      if (!match) continue;

      // 关键词匹配
      if (match.keywords) {
        const matchedKeyword = match.keywords.find(kw => lowerQuery.includes(kw.toLowerCase()));
        if (matchedKeyword) {
          console.log(`[SearchStrategy] 匹配策略: ${strategy.name} (关键词: ${matchedKeyword})`);
          return strategy;
        }
      }

      // 正则表达式匹配
      if (match.queryPattern) {
        const regex = new RegExp(match.queryPattern, 'i');
        if (regex.test(query)) {
          console.log(`[SearchStrategy] 正则匹配策略: ${strategy.name}`);
          return strategy;
        }
      }
    }

    console.log(`[SearchStrategy] 未找到匹配策略`);
    return null;
  }

  /**
   * 添加自定义策略
   */
  addStrategy(strategy: SearchStrategyRule): void {
    this.strategies.push(strategy);
    console.log(`[SearchStrategy] 添加策略: ${strategy.name}`);
  }

  /**
   * 更新策略列表
   */
  setStrategies(strategies: SearchStrategyRule[]): void {
    this.strategies = strategies;
  }

  /**
   * 获取所有策略
   */
  getStrategies(): SearchStrategyRule[] {
    return [...this.strategies];
  }
}

// ============================================
// Provider 基类
// ============================================

/**
 * 通用搜索 Provider 基类
 */
abstract class BaseSearchProvider implements SearchProvider {
  abstract name: string;
  protected config: SearchProviderConfig;

  constructor(config: SearchProviderConfig) {
    this.config = config;
  }

  abstract search(query: string, options?: { maxResults?: number }): Promise<SearchResult[]>;

  getConfig(): SearchProviderConfig {
    return this.config;
  }
}

/**
 * Tavily Search Provider
 */
export class TavilySearchProvider extends BaseSearchProvider {
  name = 'Tavily';

  constructor(config: SearchProviderConfig) {
    super(config);
    this.name = config.name || 'Tavily';
  }

  async search(query: string, options?: { maxResults?: number }): Promise<SearchResult[]> {
    if (!this.config.apiKey) {
      console.warn(`[${this.name}] API Key 未配置，跳过搜索`);
      return [];
    }

    try {
      const response: any = await fetch(this.config.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.config.apiKey,
          query,
          max_results: options?.maxResults || 10,
          include_answer: false,
          search_depth: 'advanced'
        })
      });

      if (!response.ok) {
        console.error(`[${this.name}] API 错误:`, await response.text());
        return [];
      }

      const data = await response.json();
      
      return (data.results || []).map((r: any, i: number) => {
        // 🔥 限制 snippet 长度，避免 token 爆炸
        const maxLength = 1200;
        const rawContent = r.content || r.snippet || '';
        const snippet = rawContent.length > maxLength 
          ? rawContent.substring(0, maxLength) + '...' 
          : rawContent;
        
        return {
          id: `tavily_${i}_${Date.now()}`,
          title: r.title || '',
          url: r.url || '',
          snippet: snippet,
          publishedDate: r.published_date,
          source: this.name,
          score: r.score || 0.5,
          relevance: r.score || 0.5,
        };
      });
    } catch (error) {
      console.error(`[${this.name}] 搜索失败:`, error);
      return [];
    }
  }
}

/**
 * Qwen 联网搜索 Provider
 */
export class QwenSearchProvider extends BaseSearchProvider {
  name = 'QwenSearch';

  constructor(config: SearchProviderConfig) {
    super(config);
    this.name = config.name || 'QwenSearch';
  }

  async search(query: string, options?: { maxResults?: number }): Promise<SearchResult[]> {
    if (!this.config.apiKey) {
      console.warn(`[${this.name}] API Key 未配置，跳过搜索`);
      return [];
    }

    try {
      const maxResults = options?.maxResults || 10;
      
      const response: any = await fetch(this.config.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'qwen-plus',
          messages: [{
            role: 'user',
            content: `请搜索并总结关于"${query}"的最新信息，列出${maxResults}个相关网页的标题、链接和摘要。以JSON格式返回：{"results":[{"title":"...","url":"...","snippet":"..."}]}`
          }],
          extra_body: { enable_search: true },
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        console.error(`[${this.name}] API 错误:`, await response.text());
        return [];
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '{"results":[]}';
      
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        console.error(`[${this.name}] JSON 解析失败:`, content);
        return [];
      }
      
      return (parsed.results || []).map((r: any, i: number) => ({
        id: `qwen_${i}_${Date.now()}`,
        title: r.title || '',
        url: r.url || '',
        snippet: r.snippet || '',
        source: this.name,
        score: 0.6,
        relevance: 0.6,
      }));
    } catch (error) {
      console.error(`[${this.name}] 搜索失败:`, error);
      return [];
    }
  }
}

/**
 * SerpAPI 搜索 Provider (Google Search)
 */
export class SerpAPISearchProvider extends BaseSearchProvider {
  name = 'SerpAPI';

  constructor(config: SearchProviderConfig) {
    super(config);
    this.name = config.name || 'SerpAPI';
  }

  async search(query: string, options?: { maxResults?: number }): Promise<SearchResult[]> {
    if (!this.config.apiKey) {
      console.warn(`[${this.name}] API Key 未配置，跳过搜索`);
      return [];
    }

    try {
      const maxResults = options?.maxResults || 10;
      const searchParams = new URLSearchParams({
        q: query,
        api_key: this.config.apiKey,
        engine: 'google',
        num: Math.min(maxResults, 10).toString(),
      });

      const response: any = await fetch(`${this.config.url}?${searchParams.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        console.error(`[${this.name}] API 错误:`, await response.text());
        return [];
      }

      const data = await response.json();
      const organicResults = data.organic_results || [];

      return organicResults.slice(0, maxResults).map((r: any, i: number) => ({
        id: `serpapi_${i}_${Date.now()}`,
        title: r.title || '',
        url: r.link || r.url || '',
        snippet: r.snippet || r.description || '',
        publishedDate: r.date,
        source: this.name,
        score: r.position ? 1 / r.position : 0.5,
        relevance: r.position ? 1 / r.position : 0.5,
      }));
    } catch (error) {
      console.error(`[${this.name}] 搜索失败:`, error);
      return [];
    }
  }
}

/**
 * Bing Search Provider
 */
export class BingSearchProvider extends BaseSearchProvider {
  name = 'Bing';

  constructor(config: SearchProviderConfig) {
    super(config);
    this.name = config.name || 'Bing';
  }

  async search(query: string, options?: { maxResults?: number }): Promise<SearchResult[]> {
    if (!this.config.apiKey) {
      console.warn(`[${this.name}] API Key 未配置，跳过搜索`);
      return [];
    }

    try {
      const maxResults = options?.maxResults || 10;
      const searchParams = new URLSearchParams({
        q: query,
        count: Math.min(maxResults, 50).toString(),
        mkt: 'zh-CN',
      });

      const response: any = await fetch(`${this.config.url}?${searchParams.toString()}`, {
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': this.config.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`[${this.name}] API 错误:`, await response.text());
        return [];
      }

      const data = await response.json();
      const webPages = data.webPages?.value || [];

      return webPages.slice(0, maxResults).map((r: any, i: number) => ({
        id: `bing_${i}_${Date.now()}`,
        title: r.name || r.title || '',
        url: r.url || r.link || '',
        snippet: r.snippet || r.description || '',
        publishedDate: r.dateLastCrawled,
        source: this.name,
        score: 0.6,
        relevance: 0.6,
      }));
    } catch (error) {
      console.error(`[${this.name}] 搜索失败:`, error);
      return [];
    }
  }
}

/**
 * 通用 HTTP 搜索 Provider
 * 用于自定义搜索源
 */
export class GenericSearchProvider extends BaseSearchProvider {
  name = 'Generic';

  constructor(config: SearchProviderConfig) {
    super(config);
    this.name = config.name || 'Generic';
  }

  private extractValue(obj: any, path: string): any {
    if (!path) return obj;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  private buildRequest(query: string, maxResults: number): { url: string; method: string; headers: Record<string, string>; body?: string } {
    const template = this.config.requestTemplate;
    
    if (!template) {
      return {
        url: this.config.url,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, max_results: maxResults })
      };
    }

    let url = this.config.url;
    const headers: Record<string, string> = {};
    let body: string | undefined;

    const apiKey = this.config.apiKey || '';

    if (template.method === 'GET') {
      if (template.queryTemplate) {
        let queryString = template.queryTemplate
          .replace(/\$\{query\}/g, encodeURIComponent(query))
          .replace(/\$\{maxResults\}/g, String(maxResults));
        
        if (template.authType === 'query' && apiKey && template.authQueryParam) {
          queryString += `&${template.authQueryParam}=${encodeURIComponent(apiKey)}`;
        }
        
        url = `${this.config.url}?${queryString}`;
      }

      if (template.authType === 'header' && apiKey && template.authHeaderName) {
        headers[template.authHeaderName] = apiKey;
      }
    } else if (template.method === 'POST') {
      headers['Content-Type'] = 'application/json';

      if (template.authType === 'header' && apiKey && template.authHeaderName) {
        headers[template.authHeaderName] = apiKey;
      }

      if (template.bodyTemplate) {
        body = template.bodyTemplate
          .replace(/\$\{apiKey\}/g, apiKey)
          .replace(/\$\{query\}/g, query)
          .replace(/\$\{maxResults\}/g, String(maxResults));
      } else if (template.authType === 'body' && apiKey && template.authQueryParam) {
        body = JSON.stringify({
          [template.authQueryParam]: apiKey,
          query,
          max_results: maxResults
        });
      } else {
        body = JSON.stringify({ query, max_results: maxResults });
      }
    }

    return { url, method: template.method, headers, body };
  }

  private parseResponse(data: any): SearchResult[] {
    const template = this.config.responseTemplate;

    if (!template) {
      const results = data.results || data.data || data.items || [];
      return results.map((r: any, i: number) => ({
        id: `${this.name.toLowerCase()}_${i}_${Date.now()}`,
        title: r.title || r.name || '',
        url: r.url || r.link || r.href || '',
        snippet: r.snippet || r.content || r.description || r.summary || '',
        source: this.name,
        score: r.score || r.relevance || 0.5,
        relevance: r.score || r.relevance || 0.5,
      }));
    }

    const resultsArray = this.extractValue(data, template.resultsPath) || [];
    
    return resultsArray.map((r: any, i: number) => ({
      id: `${this.name.toLowerCase()}_${i}_${Date.now()}`,
      title: this.extractValue(r, template.titlePath) || '',
      url: this.extractValue(r, template.urlPath) || '',
      snippet: this.extractValue(r, template.snippetPath) || '',
      source: this.name,
      score: 0.5,
      relevance: 0.5,
    }));
  }

  async search(query: string, options?: { maxResults?: number }): Promise<SearchResult[]> {
    const template = this.config.requestTemplate;
    const needApiKey = template?.authType !== 'none';
    
    if (needApiKey && !this.config.apiKey) {
      console.warn(`[${this.name}] API Key 未配置，跳过搜索`);
      return [];
    }

    try {
      const maxResults = options?.maxResults || 10;
      const requestConfig = this.buildRequest(query, maxResults);

      console.log(`[${this.name}] 发送请求:`, requestConfig.url);

      const response: any = await fetch(requestConfig.url, {
        method: requestConfig.method,
        headers: requestConfig.headers,
        body: requestConfig.body
      });

      if (!response.ok) {
        console.error(`[${this.name}] API 错误:`, await response.text());
        return [];
      }

      const data = await response.json();
      return this.parseResponse(data);
    } catch (error) {
      console.error(`[${this.name}] 搜索失败:`, error);
      return [];
    }
  }
}

/**
 * HuggingFace Model Search Provider
 * 搜索 HuggingFace 上的开源模型
 */
export class HuggingFaceSearchProvider extends BaseSearchProvider {
  name = 'HuggingFace';

  constructor(config: SearchProviderConfig) {
    super(config);
  }

  async search(query: string, options?: { maxResults?: number }): Promise<SearchResult[]> {
    try {
      const maxResults = options?.maxResults || 10;

      // HuggingFace API 不需要 API Key 进行搜索
      const searchUrl = `https://huggingface.co/api/models?search=${encodeURIComponent(query)}&limit=${maxResults}`;

      // 添加超时控制（5秒），避免 HuggingFace 访问慢导致整体搜索阻塞
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response: any = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {})
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`[${this.name}] API 错误:`, await response.text());
        return [];
      }

      const models = await response.json();

      return models.map((model: any, i: number) => {
        const modelId = model.modelId || model.id || '';
        const downloads = model.downloads || 0;
        const likes = model.likes || 0;
        const tags = model.tags || [];
        
        // 构建描述文本
        let snippet = model.description || '';
        if (tags.length > 0) {
          snippet += `\n标签: ${tags.slice(0, 5).join(', ')}`;
        }
        snippet += `\n下载: ${downloads.toLocaleString()} | 点赞: ${likes}`;

        return {
          id: `huggingface_${i}_${Date.now()}`,
          title: modelId,
          url: `https://huggingface.co/${modelId}`,
          snippet: snippet.trim(),
          publishedDate: model.lastModified,
          source: this.name,
          score: (likes / 1000) + (downloads / 10000),
          relevance: Math.min(0.9, (likes / 1000) + (downloads / 10000)),
        };
      });
    } catch (error) {
      console.error(`[${this.name}] 搜索失败:`, error);
      return [];
    }
  }
}

/**
 * arXiv Paper Search Provider
 * 搜索 arXiv 学术论文
 */
export class ArxivSearchProvider extends BaseSearchProvider {
  name = 'arXiv';

  constructor(config: SearchProviderConfig) {
    super(config);
  }

  async search(query: string, options?: { maxResults?: number }): Promise<SearchResult[]> {
    try {
      const maxResults = options?.maxResults || 10;
      
      // arXiv API (无需 API Key)
      const searchUrl = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;
      
      const response: any = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/xml',
        }
      });

      if (!response.ok) {
        console.error(`[${this.name}] API 错误:`, await response.text());
        return [];
      }

      const xmlText = await response.text();
      
      // 解析 XML 响应
      const entries = this.parseArxivXml(xmlText);

      return entries.map((entry: any, i: number) => ({
        id: `arxiv_${i}_${Date.now()}`,
        title: entry.title || '',
        url: entry.pdfUrl || entry.id || '',
        snippet: entry.summary || '',
        publishedDate: entry.published,
        source: this.name,
        score: 0.8,
        relevance: 0.8,
      }));
    } catch (error) {
      console.error(`[${this.name}] 搜索失败:`, error);
      return [];
    }
  }

  private parseArxivXml(xmlText: string): any[] {
    const entries: any[] = [];
    
    // 简单的 XML 解析
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;
    
    while ((match = entryRegex.exec(xmlText)) !== null) {
      const entryXml = match[1];
      
      const titleMatch = entryXml.match(/<title>([\s\S]*?)<\/title>/);
      const summaryMatch = entryXml.match(/<summary>([\s\S]*?)<\/summary>/);
      const idMatch = entryXml.match(/<id>([\s\S]*?)<\/id>/);
      const publishedMatch = entryXml.match(/<published>([\s\S]*?)<\/published>/);
      const pdfMatch = entryXml.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/);
      
      if (titleMatch) {
        entries.push({
          title: this.cleanXmlText(titleMatch[1]),
          summary: this.cleanXmlText(summaryMatch?.[1] || ''),
          id: this.cleanXmlText(idMatch?.[1] || ''),
          published: this.cleanXmlText(publishedMatch?.[1] || ''),
          pdfUrl: pdfMatch ? pdfMatch[1] : this.cleanXmlText(idMatch?.[1] || ''),
        });
      }
    }
    
    return entries;
  }

  private cleanXmlText(text: string): string {
    return text
      .replace(/<[^>]+>/g, '') // 移除所有标签
      .replace(/\s+/g, ' ')     // 合并空白
      .trim();
  }
}

/**
 * 聚合搜索 Provider
 * 从配置中读取所有搜索源，支持可配置的搜索策略
 */
export class AggregateSearchProvider implements SearchProvider {
  name = 'Aggregate';
  private providers: SearchProvider[] = [];
  private currentUserId: string | null = null;
  private strategyManager: SearchStrategyManager;

  constructor(userId?: string, strategies?: SearchStrategyRule[]) {
    this.currentUserId = userId || null;
    this.strategyManager = new SearchStrategyManager(strategies);
    this.loadProvidersFromConfig();
  }

  /**
   * 设置当前用户ID并重新加载搜索源
   */
  setUserId(userId: string): void {
    if (this.currentUserId !== userId) {
      console.log(`[AggregateSearch] 切换用户: ${this.currentUserId || 'null'} -> ${userId}`);
      this.currentUserId = userId;
      this.loadProvidersFromConfig();
    }
  }

  /**
   * 从配置加载搜索源
   * 根据 providerType 选择对应的 Provider 实现
   */
  private loadProvidersFromConfig(): void {
    // 🔥 拒绝 default 用户或空用户
    if (!this.currentUserId || this.currentUserId === 'default') {
      console.warn(`[AggregateSearch] 拒绝为未登录用户加载搜索源`);
      this.providers = [];
      return;
    }

    try {
      // 🔥 设置当前用户，确保加载正确的用户配置
      userModelRegistry.setCurrentUser(this.currentUserId);
      const configs = userModelRegistry.getAllSearchProviders();

      this.providers = configs
        .filter((config: SearchProviderConfig) => {
          // 🔥 只加载 type 为 search 的搜索源
          if (config.type !== 'search') return false;
          
          // 🔥 对于不需要 API Key 的搜索源（huggingface, arxiv），允许空 apiKey
          const noApiKeyRequired = ['huggingface', 'arxiv'].includes(config.providerType || '');
          if (noApiKeyRequired) return true;
          
          // 其他搜索源需要 API Key
          return !!config.apiKey;
        })
        .map((config: SearchProviderConfig) => {
          // 根据 providerType 选择对应的 Provider 实现
          switch (config.providerType) {
            case 'tavily':
              return new TavilySearchProvider(config);
            case 'qwen':
              return new QwenSearchProvider(config);
            case 'serpapi':
              return new SerpAPISearchProvider(config);
            case 'bing':
              return new BingSearchProvider(config);
            case 'huggingface':
              return new HuggingFaceSearchProvider(config);
            case 'arxiv':
              return new ArxivSearchProvider(config);
            default:
              console.warn(`[AggregateSearch] 未知的搜索源类型: ${config.providerType}，使用通用 Provider`);
              return new GenericSearchProvider(config);
          }
        });

      console.log(`[AggregateSearch] 已加载 ${this.providers.length} 个搜索源 (用户: ${this.currentUserId})`);
    } catch (error) {
      console.error('[AggregateSearch] 加载搜索源失败:', error);
      this.providers = [];
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

  /**
   * 分配搜索配额
   * 将 maxResults 随机分配给各个搜索源
   */
  private distributeQuota(totalQuota: number, numProviders: number): number[] {
    if (numProviders === 0) return [];
    if (numProviders === 1) return [totalQuota];

    // 随机分配基础配额
    const baseQuota = Math.floor(totalQuota / numProviders);
    const quotas = new Array(numProviders).fill(baseQuota);
    
    // 分配剩余配额
    let remaining = totalQuota - baseQuota * numProviders;
    while (remaining > 0) {
      const idx = Math.floor(Math.random() * numProviders);
      quotas[idx]++;
      remaining--;
    }

    // 随机打乱配额分配
    return this.shuffleArray(quotas);
  }

  async search(query: string, options?: { maxResults?: number; userId?: string }): Promise<SearchResult[]> {
    // 🔥 如果传入了 userId，切换到对应用户
    if (options?.userId) {
      this.setUserId(options.userId);
    }
    
    // 🔥 只在第一次或providers为空时加载配置
    if (this.providers.length === 0) {
      this.loadProvidersFromConfig();
    }

    if (this.providers.length === 0) {
      console.warn('[AggregateSearch] 没有可用的搜索源');
      return [];
    }

    const maxResults = options?.maxResults || 10;
    
    // 🔥 选择搜索策略
    const strategy = this.strategyManager.selectStrategy(query);
    
    if (strategy) {
      console.log(`[AggregateSearch] 使用策略: ${strategy.name}`);
      return this.searchWithStrategy(query, maxResults, strategy);
    } else {
      console.log(`[AggregateSearch] 无匹配策略，使用默认搜索`);
      return this.searchDefault(query, maxResults);
    }
  }

  /**
   * 使用策略进行搜索
   */
  private async searchWithStrategy(
    query: string, 
    maxResults: number, 
    strategy: SearchStrategyRule
  ): Promise<SearchResult[]> {
    const config = strategy.providerConfig;
    
    // 按优先级排序 providers（只包含策略配置的源）
    const sortedProviders = this.sortProvidersByPriority(config.priority);
    
    if (sortedProviders.length === 0) {
      console.warn(`[AggregateSearch] 策略 ${strategy.name} 没有匹配的搜索源`);
      return this.searchDefault(query, maxResults);
    }

    // 🔥 修改：fallback 只回退到策略配置的其他源，而不是所有剩余源
    let providersToUse: SearchProvider[];
    if (config.exclusive) {
      // 独占模式：只使用优先级匹配的源
      providersToUse = sortedProviders;
    } else if (config.fallback) {
      // 回退模式：使用策略配置的所有源（按优先级排序）
      // 不再添加未在 priority 中配置的源
      providersToUse = sortedProviders;
    } else {
      // 不回退：只使用优先级最高的源
      providersToUse = sortedProviders.slice(0, 1);
    }

    console.log(`[AggregateSearch] 策略使用 ${providersToUse.length} 个搜索源: ${providersToUse.map(p => p.name).join(', ')}`);

    // 根据配额比例分配
    const quotas = config.quotaRatio 
      ? this.distributeQuotaByRatio(maxResults, providersToUse, config.quotaRatio)
      : this.distributeQuota(maxResults, providersToUse.length);

    // 并行执行搜索
    const results = await Promise.all(
      providersToUse.map(async (provider, index) => {
        const quota = quotas[index] || Math.ceil(maxResults / providersToUse.length);
        try {
          const providerResults = await provider.search(query, { maxResults: quota });
          console.log(`[${provider.name}] 返回 ${providerResults.length} 个结果`);
          return providerResults;
        } catch (err) {
          console.warn(`[${provider.name}] 搜索失败:`, err);
          return [];
        }
      })
    );

    return this.processAndRankResults(results.flat(), maxResults, strategy);
  }

  private calculateKeywordMatchScore(query: string, keywords: string[]): number {
    if (!keywords || keywords.length === 0) return 0;
    
    const lowerQuery = query.toLowerCase();
    let matchCount = 0;
    
    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();
      if (lowerQuery.includes(lowerKeyword)) {
        matchCount++;
      }
    }
    
    return matchCount / keywords.length;
  }

  private scoreProviders(query: string): Array<{ provider: SearchProvider; score: number }> {
    const scoredProviders: Array<{ provider: SearchProvider; score: number }> = [];
    
    for (const provider of this.providers) {
      const config = (provider as BaseSearchProvider).getConfig();
      const keywords = config.keywords || [];
      const providerType = config.providerType || '';
      
      const isGeneral = config.isGeneral !== false && ['tavily', 'bing', 'serpapi', 'qwen'].includes(providerType);
      const isUserCreated = providerType === 'generic';
      
      let score = 0;
      
      if (isGeneral) {
        score = 0.3;
      } else if (isUserCreated) {
        score = 0.2;
      } else {
        score = 0.1;
      }
      
      if (keywords.length > 0) {
        const keywordMatchScore = this.calculateKeywordMatchScore(query, keywords);
        score += keywordMatchScore * 0.5;
      }
      
      scoredProviders.push({ provider, score });
    }
    
    return scoredProviders.sort((a, b) => b.score - a.score);
  }

  private selectTopKProviders(scoredProviders: Array<{ provider: SearchProvider; score: number }>, topK: number = 3): SearchProvider[] {
    const minScore = 0.15;
    const qualifiedProviders = scoredProviders.filter(p => p.score >= minScore);
    
    if (qualifiedProviders.length === 0) {
      console.log(`[AggregateSearch] 没有搜索源达到最低分数 ${minScore}，使用 Top-K`);
      return scoredProviders.slice(0, topK).map(p => p.provider);
    }
    
    const selectedCount = Math.min(qualifiedProviders.length, topK);
    console.log(`[AggregateSearch] 选择 ${selectedCount} 个搜索源 (分数 >= ${minScore})`);
    
    return qualifiedProviders.slice(0, selectedCount).map(p => p.provider);
  }

  /**
   * 默认搜索（无策略匹配时使用）
   */
  private async searchDefault(query: string, maxResults: number): Promise<SearchResult[]> {
    console.log(`[AggregateSearch] 使用 ${this.providers.length} 个搜索源，目标结果数: ${maxResults}`);

    const scoredProviders = this.scoreProviders(query);
    console.log(`[AggregateSearch] 搜索源评分:`, scoredProviders.map(p => `${p.provider.name}: ${p.score.toFixed(2)}`).join(', '));

    const selectedProviders = this.selectTopKProviders(scoredProviders, 3);
    console.log(`[AggregateSearch] 选择搜索源: ${selectedProviders.map(p => p.name).join(', ')}`);

    if (selectedProviders.length === 0) {
      console.warn('[AggregateSearch] 没有可用的搜索源');
      return [];
    }

    const quotas = this.distributeQuota(maxResults, selectedProviders.length);

    const results = await Promise.all(
      selectedProviders.map(async (provider, index) => {
        const quota = quotas[index];
        try {
          const providerResults = await provider.search(query, { maxResults: quota });
          console.log(`[${provider.name}] 返回 ${providerResults.length} 个结果`);
          return providerResults;
        } catch (err) {
          console.warn(`[${provider.name}] 搜索失败:`, err);
          return [];
        }
      })
    );

    return this.processAndRankResults(results.flat(), maxResults);
  }

  /**
   * 处理和排序结果
   */
  private processAndRankResults(
    allResults: SearchResult[], 
    maxResults: number,
    strategy?: SearchStrategyRule
  ): SearchResult[] {
    console.log(`[AggregateSearch] 总计收集 ${allResults.length} 个结果`);

    // 去重
    const uniqueResults = this.deduplicateByUrl(allResults);
    console.log(`[AggregateSearch] 去重后剩余 ${uniqueResults.length} 个结果`);

    // 如果有策略且配置了域名匹配，对匹配的域名加权
    if (strategy?.match?.domains) {
      const domains = strategy.match.domains;
      uniqueResults.forEach(result => {
        if (domains.some(d => result.url.includes(d))) {
          result.relevance = Math.min(1, result.relevance + 0.1); // 提升相关性
        }
      });
    }

    // 按相关性排序
    return uniqueResults.sort((a, b) => b.relevance - a.relevance).slice(0, maxResults);
  }

  /**
   * 按优先级排序 providers
   */
  private sortProvidersByPriority(priority: string[]): SearchProvider[] {
    const sorted: SearchProvider[] = [];
    const remaining = [...this.providers];

    // 按优先级顺序添加
    for (const type of priority) {
      const index = remaining.findIndex(p => 
        p.name.toLowerCase().includes(type.toLowerCase())
      );
      if (index !== -1) {
        sorted.push(remaining[index]);
        remaining.splice(index, 1);
      }
    }

    return sorted;
  }

  /**
   * 获取剩余的 providers（不在已选列表中的）
   */
  private getRemainingProviders(excluded: SearchProvider[]): SearchProvider[] {
    return this.providers.filter(p => !excluded.includes(p));
  }

  /**
   * 按比例分配配额
   */
  private distributeQuotaByRatio(
    totalQuota: number, 
    providers: SearchProvider[],
    ratio: Record<string, number>
  ): number[] {
    const quotas: number[] = [];
    let allocated = 0;

    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i];
      const providerType = Object.keys(ratio).find(type => 
        provider.name.toLowerCase().includes(type.toLowerCase())
      );
      
      if (providerType && ratio[providerType]) {
        const quota = Math.floor(totalQuota * ratio[providerType]);
        quotas[i] = quota;
        allocated += quota;
      } else {
        quotas[i] = 0;
      }
    }

    // 分配剩余配额
    let remaining = totalQuota - allocated;
    while (remaining > 0) {
      const idx = quotas.findIndex(q => q > 0);
      if (idx === -1) break;
      quotas[idx]++;
      remaining--;
    }

    return quotas;
  }

  /**
   * 设置自定义搜索策略
   */
  setStrategies(strategies: SearchStrategyRule[]): void {
    this.strategyManager.setStrategies(strategies);
    console.log(`[AggregateSearch] 已更新搜索策略，共 ${strategies.length} 个`);
  }

  /**
   * 添加搜索策略
   */
  addStrategy(strategy: SearchStrategyRule): void {
    this.strategyManager.addStrategy(strategy);
  }

  /**
   * 获取当前所有策略
   */
  getStrategies(): SearchStrategyRule[] {
    return this.strategyManager.getStrategies();
  }

  private deduplicateByUrl(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      const normalizedUrl = this.normalizeUrl(result.url);
      if (seen.has(normalizedUrl)) return false;
      seen.add(normalizedUrl);
      return true;
    });
  }

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '') + parsed.pathname.replace(/\/$/, '');
    } catch {
      return url;
    }
  }

  /**
   * 获取当前可用的搜索源数量
   */
  getProviderCount(): number {
    return this.providers.length;
  }
}

/**
 * 创建聚合搜索 Provider 的工厂函数
 */
export function createAggregateSearchProvider(): AggregateSearchProvider {
  return new AggregateSearchProvider();
}
