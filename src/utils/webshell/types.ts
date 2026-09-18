export interface DeepResearchRequest {
  query: string;
  options?: DeepResearchOptions;
  userId: string;
  conversationId: string;
}

export interface DeepResearchOptions {
  maxSources?: number;
  depth?: 'shallow' | 'medium' | 'deep';
  includeAcademic?: boolean;
  language?: 'zh-CN' | 'en-US';
  timeRange?: number;
  domain?: string;
  enableIterative?: boolean;
}

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  author?: string;
  source: string;
  score: number;
  relevance: number;
}

export interface ProcessedSource {
  id: string;
  url: string;
  title: string;
  content: string;
  summary: string;
  keyPoints: string[];
  citations: Citation[];
  quality: {
    credibility: number;
    depth: number;
    relevance: number;
  };
  metadata: {
    author?: string;
    publishedDate?: string;
    domain: string;
    wordCount: number;
  };
}

export interface Citation {
  text: string;
  sourceId: string;
  paragraph: number;
  url: string;
}

export interface ResearchInsight {
  type: 'agreement' | 'contradiction' | 'gap' | 'trend';
  description: string;
  sources: string[];
  confidence: number;
}

export interface DeepResearchResult {
  success: boolean;
  query: string;
  markdown: string;
  sources: ProcessedSource[];
  insights: ResearchInsight[];
  stats: {
    totalSources: number;
    processedSources: number;
    totalWordCount: number;
    executionTime: number;
  };
  metadata: {
    timestamp: string;
    version: string;
  };
  error?: string;
}

export interface SearchProvider {
  name: string;
  search(query: string, options?: any): Promise<SearchResult[]>;
}

export interface FetchProvider {
  name: string;
  fetch(url: string): Promise<{ content: string; metadata: any }>;
}

export interface SummarizeProvider {
  name: string;
  summarize(content: string, prompt?: string): Promise<string>;
  extractKeyPoints(content: string): Promise<string[]>;
}
