/**
 * 简单搜索服务
 * 轻量级搜索工具，用于快速检索相关信息并生成综合报告
 *
 * 架构：
 * 1. 从配置加载搜索源（聚合搜索）
 * 2. 执行单次搜索
 * 3. 使用 LLM 生成综合报告
 */

import { SearchProvider } from './types';
import { createAggregateSearchProvider, AggregateSearchProvider } from './providers/SearchProviders';

export interface SimpleSearchRequest {
  query: string;
  maxResults?: number;
  userId?: string;
  conversationId?: string;
}

export interface SimpleSearchResultItem {
  title: string;
  url: string;
  content: string;
  snippet: string;
}

export interface SimpleSearchResponse {
  success: boolean;
  query: string;
  results: SimpleSearchResultItem[];
  summary: string;
  error?: string;
}

/**
 * 简单搜索服务类
 * 🔥 直接返回搜索结果，不进行 LLM 总结，避免 Token 浪费
 */
export class SimpleSearchService {
  private searchProvider: SearchProvider;

  constructor() {
    // 使用聚合搜索 Provider，自动从配置加载所有搜索源
    this.searchProvider = createAggregateSearchProvider();

    console.log('✅ [SIMPLE-SEARCH] 服务已初始化');
  }

  /**
   * 执行简单搜索
   * @param request 搜索请求
   * @returns 搜索结果和报告
   */
  async search(request: SimpleSearchRequest): Promise<SimpleSearchResponse> {
    try {
      console.log('🔍 [SIMPLE-SEARCH] 开始执行搜索:', {
        query: request.query,
        maxResults: request.maxResults || 5,
        userId: request.userId,
      });

      // 🔥 设置用户ID到搜索Provider
      if (this.searchProvider instanceof AggregateSearchProvider) {
        this.searchProvider.setUserId(request.userId || '');
      }

      // 🔥 检查搜索源配置
      const providerCount = this.searchProvider instanceof AggregateSearchProvider 
        ? this.searchProvider.getProviderCount() 
        : 1;
      
      if (providerCount === 0) {
        console.warn('[SIMPLE-SEARCH] 未配置搜索源');
        return {
          success: false,
          query: request.query,
          results: [],
          summary: this.generateNoSearchSourceMessage(),
          error: '未配置搜索源',
        };
      }

      // 设置默认值
      const maxResults = request.maxResults || 10;

      // 执行聚合搜索
      console.log('📡 [SIMPLE-SEARCH] 执行聚合搜索...');
      const searchResults = await this.searchProvider.search(
        request.query,
        { maxResults: Math.ceil(maxResults * 2) }
      );

      console.log(`✅ [SIMPLE-SEARCH] 搜索返回 ${searchResults.length} 个结果`);

      // 整理结果
      const results: SimpleSearchResultItem[] = searchResults.slice(0, maxResults).map(item => ({
        title: item.title || '',
        url: item.url || '',
        content: item.snippet || '',
        snippet: item.snippet || item.title || ''
      }));

      // 🔥 简单搜索：直接返回格式化结果，不经过 LLM Summarize
      const summary = this.generateSimpleSummary(results, request.query);

      console.log('✅ [SIMPLE-SEARCH] 搜索完成:', {
        query: request.query,
        resultCount: results.length,
        summaryLength: summary.length
      });

      return {
        success: true,
        query: request.query,
        results: results,
        summary: summary
      };
    } catch (error) {
      console.error('❌ [SIMPLE-SEARCH] 搜索失败:', error);
      return {
        success: false,
        query: request.query,
        results: [],
        summary: '',
        error: error instanceof Error ? error.message : '搜索过程中发生未知错误'
      };
    }
  }

  /**
   * 生成简单摘要（直接格式化搜索结果）
   * @param results 搜索结果
   * @param query 查询词
   * @returns 格式化的搜索摘要
   */
  private generateSimpleSummary(results: SimpleSearchResultItem[], query: string): string {
    if (results.length === 0) {
      return `关于"${query}"未找到相关搜索结果。`;
    }

    const lines: string[] = [];
    lines.push(`## "${query}" 的搜索结果`);
    lines.push('');

    results.forEach((result, index) => {
      const title = result.title || '无标题';
      const snippet = result.snippet || result.content || '';
      lines.push(`${index + 1}. **${title}**`);
      lines.push(`   ${snippet}`);
      lines.push(`   [来源](${result.url})`);
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * 🔥 生成未配置搜索源的友好提示消息
   */
  private generateNoSearchSourceMessage(): string {
    return `## 🔍 搜索源未配置

抱歉，无法进行搜索，因为您尚未配置搜索源。如果你是agent，请立即停止后续搜索请求或绕开搜索，并向用户反馈一下信息：

### 📖 什么是搜索源？
搜索源是用来获取信息的搜索引擎 API，例如：
- **Tavily** - 专为 AI 优化的搜索引擎
- **Bing Search** - 微软必应搜索 API
- **SerpAPI** - Google 搜索结果 API
- **Qwen 联网搜索** - 阿里云通义千问联网搜索

### ⚙️ 如何配置？
1. 点击右上角的 **模型设置** 按钮
2. 进入 **搜索源配置**
3. 添加至少一个搜索源（需要对应的 API Key）

### 💡 推荐配置
我们推荐配置 **Tavily** 或 **Bing Search**，它们提供更结构化的搜索结果。

---
*配置完成后，重新发起搜索请求即可。*`;
  }
}

// 注意：不再导出默认单例实例
// 请使用 new SimpleSearchService(config) 创建实例，config 从用户配置中获取
