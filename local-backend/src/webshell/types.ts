/**
 * DeepResearch 类型定义
 * 与前端保持一致
 */

export interface DeepResearchRequest {
  query: string;
  userId: string;
  conversationId: string;
  options?: DeepResearchOptions;
}

export interface DeepResearchOptions {
  maxSources?: number;
  depth?: 'shallow' | 'medium' | 'deep';
  includeAcademic?: boolean;
  language?: 'zh-CN' | 'en-US';
  timeRange?: number;
  domain?: string;
  // 🔥 新增：策略配置（可选，用于精细控制）
  strategy?: {
    // 广度配置
    breadth?: {
      maxSources?: number;
      searchMultiplier?: number;
      maxSubQuestions?: number;
    };
    // 深度配置
    depth?: {
      fetchTimeout?: number;
      summaryMaxLength?: number;
      keyPointsCount?: number;
    };
  };
}

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  domain?: string;
  source?: string;
  score?: number;
  relevance: number;
}

export interface ProcessedSource {
  id: string;
  url: string;
  title: string;
  content: string;
  summary: string;
  keyPoints: string[];
  quality: {
    credibility: number;
    depth: number;
    relevance: number;
  };
  metadata: {
    author?: string;
    publishedDate?: string;
    domain?: string;
    wordCount: number;
  };
}

export interface DeepResearchResult {
  success: boolean;
  query: string;
  markdown?: string;
  sources?: ProcessedSource[];
  insights?: any[];
  stats?: {
    totalSources: number;
    processedSources: number;
    totalWordCount: number;
    executionTime: number;
  };
  metadata?: {
    timestamp: string;
    version: string;
  };
  error?: string;
}

// ==================== Provider 接口 ====================

export interface SearchProvider {
  name: string;
  search(query: string, options?: { maxResults?: number; userId?: string }): Promise<SearchResult[]>;
}

export interface FetchProvider {
  name: string;
  fetch(url: string, userId?: string): Promise<{ content: string; metadata: any }>;
}

export interface SummarizeOptions {
  maxTokens?: number;
  summaryMaxLength?: number;
  keyPointsCount?: number;
}

export interface SummarizeProvider {
  name: string;
  summarize(content: string, customPrompt?: string, options?: SummarizeOptions): Promise<string>;
  extractKeyPoints(content: string, options?: SummarizeOptions): Promise<string[]>;
  generateInsights?(sources: ProcessedSource[], query: string): Promise<any[]>;
}
