/**
 * SearchProviderConfigTool - 搜索源配置工具
 * 
 * 功能：
 * 1. 根据用户提供的参数生成搜索源配置
 * 2. 支持自定义请求模板和响应模板
 * 3. 如果需要 API Key，返回配置让前端弹出输入框
 */

import { ToolApiClient } from '@/utils/ToolApiClient';

export interface RequestTemplate {
  method: 'GET' | 'POST';
  authType: 'header' | 'query' | 'body' | 'none';
  authHeaderName?: string;
  authQueryParam?: string;
  queryTemplate?: string;
  bodyTemplate?: string;
}

export interface ResponseTemplate {
  resultsPath: string;
  titlePath: string;
  urlPath: string;
  snippetPath: string;
}

export interface ExtendedSearchProviderConfig {
  id: string;
  name: string;
  type: 'search' | 'fetch';
  providerType: string;
  url: string;
  apiKey: string;
  apiKeyRequired?: boolean;
  requestTemplate?: RequestTemplate;
  responseTemplate?: ResponseTemplate;
  keywords?: string[];
  description?: string;
  isGeneral?: boolean;
}

export interface CreateSearchProviderRequest {
  providerName: string;
  apiUrl: string;
  requestTemplate?: RequestTemplate;
  responseTemplate?: ResponseTemplate;
  apiKeyRequired?: boolean;
  userId: string;
  keywords?: string[];
  description?: string;
}

export interface CreateSearchProviderResponse {
  success: boolean;
  config?: ExtendedSearchProviderConfig;
  needApiKey?: boolean;
  message: string;
  error?: string;
}

function generateId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `search-${slug}-${Date.now().toString(36)}`;
}

const SEARCH_PROVIDER_ERROR_GUIDE = `
搜索源配置说明：
- providerName: 搜索源名称（如 "WorkBees Search"）
- apiUrl: 搜索接口 URL，支持占位符 {query} 和 {maxResults}
  例如: https://example.com/search?q={query}&limit={maxResults}
- apiKeyRequired: 是否需要 API Key（默认 true）
- requestTemplate.authType: 认证方式
  - 'none': 无需认证（公开搜索接口）
  - 'header': API Key 放在请求头
  - 'query': API Key 放在 URL 参数
  - 'body': API Key 放在请求体

示例：创建无需 API Key 的搜索源
{
  "providerName": "MySearch",
  "apiUrl": "https://example.com/search?q={query}",
  "apiKeyRequired": false,
  "requestTemplate": { "method": "GET", "authType": "none" }
}`;

export class SearchProviderConfigTool {
  private extractKeywordsFromName(name: string): string[] {
    const words = name.toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ' ')
      .split(' ')
      .filter(w => w.length > 1);
    return words;
  }

  private extractKeywordsFromUrl(url: string): string[] {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.replace(/^www\./, '');
      const domainParts = hostname.split('.');
      const mainDomain = domainParts[0];
      return [mainDomain];
    } catch {
      return [];
    }
  }

  private generateKeywords(name: string, url: string, providedKeywords?: string[]): string[] {
    if (providedKeywords && providedKeywords.length > 0) {
      return providedKeywords;
    }

    const nameKeywords = this.extractKeywordsFromName(name);
    const urlKeywords = this.extractKeywordsFromUrl(url);
    
    const allKeywords = [...new Set([...nameKeywords, ...urlKeywords])];
    return allKeywords.filter(k => k.length > 1);
  }

  async createSearchProvider(request: CreateSearchProviderRequest): Promise<CreateSearchProviderResponse> {
    const { providerName, apiUrl, requestTemplate, responseTemplate, apiKeyRequired, userId, keywords, description } = request;

    console.log('[SEARCH-PROVIDER-CONFIG] 创建搜索源:', { providerName, apiUrl, userId, apiKeyRequired, authType: requestTemplate?.authType });

    if (!providerName || providerName.trim().length === 0) {
      return {
        success: false,
        message: '请提供搜索源名称',
        error: `providerName 参数为空。\n${SEARCH_PROVIDER_ERROR_GUIDE}`
      };
    }

    if (!apiUrl || apiUrl.trim().length === 0) {
      return {
        success: false,
        message: '请提供 API URL',
        error: `apiUrl 参数为空。\n${SEARCH_PROVIDER_ERROR_GUIDE}`
      };
    }

    const needApiKey = apiKeyRequired !== false && requestTemplate?.authType !== 'none';

    console.log('[SEARCH-PROVIDER-CONFIG] needApiKey 判断:', {
      apiKeyRequired,
      authType: requestTemplate?.authType,
      needApiKey
    });

    const defaultRequestTemplate: RequestTemplate = requestTemplate || {
      method: needApiKey ? 'POST' : 'GET',
      authType: needApiKey ? 'header' : 'none',
      authHeaderName: needApiKey ? 'Authorization' : undefined,
      queryTemplate: !needApiKey ? 'q={query}&limit={maxResults}' : undefined,
      bodyTemplate: needApiKey ? '{"query":"${query}","max_results":${maxResults}}' : undefined
    };

    const defaultResponseTemplate: ResponseTemplate = responseTemplate || {
      resultsPath: 'results',
      titlePath: 'title',
      urlPath: 'url',
      snippetPath: 'snippet'
    };

    const generatedKeywords = this.generateKeywords(providerName, apiUrl, keywords);
    const generatedDescription = description || `${providerName} 搜索源`;

    const config: ExtendedSearchProviderConfig = {
      id: generateId(providerName),
      name: providerName,
      type: 'search',
      providerType: 'generic',
      url: apiUrl,
      apiKey: '',
      apiKeyRequired: needApiKey,
      requestTemplate: defaultRequestTemplate,
      responseTemplate: defaultResponseTemplate,
      keywords: generatedKeywords,
      description: generatedDescription,
      isGeneral: false
    };

    console.log('[SEARCH-PROVIDER-CONFIG] 生成的配置:', {
      id: config.id,
      name: config.name,
      url: config.url,
      needApiKey,
      authType: config.requestTemplate?.authType
    });

    if (!needApiKey) {
      console.log('[SEARCH-PROVIDER-CONFIG] 无需 API Key，直接保存');
      const saved = await this.saveProvider(config, userId);
      console.log('[SEARCH-PROVIDER-CONFIG] 保存结果:', saved);
      if (saved) {
        return {
          success: true,
          config,
          needApiKey: false,
          message: `搜索源 "${providerName}" 已成功添加并保存，无需 API Key`
        };
      } else {
        return {
          success: false,
          message: '保存搜索源配置失败，请检查后端服务是否正常运行',
          error: `保存失败。userId: ${userId}，请确认用户已登录。\n${SEARCH_PROVIDER_ERROR_GUIDE}`
        };
      }
    }

    console.log('[SEARCH-PROVIDER-CONFIG] 需要 API Key，返回配置等待用户输入');
    return {
      success: true,
      config,
      needApiKey: true,
      message: `搜索源 "${providerName}" 配置已生成，需要 API Key 才能使用。请在 ModelSettings 中配置 API Key。`
    };
  }

  async saveProvider(config: ExtendedSearchProviderConfig, userId: string, apiKey?: string): Promise<boolean> {
    try {
      const finalConfig = {
        ...config,
        apiKey: apiKey || config.apiKey || ''
      };

      console.log('[SEARCH-PROVIDER-CONFIG] saveProvider 调用:', {
        userId,
        providerId: config.id,
        providerName: config.name,
        url: config.url
      });

      const result = await ToolApiClient.searchProvider.save(finalConfig, userId);
      console.log('[SEARCH-PROVIDER-CONFIG] 保存结果:', result);
      return result?.success || false;
    } catch (error) {
      console.error('[SEARCH-PROVIDER-CONFIG] 保存失败:', error);
      return false;
    }
  }
}

export const searchProviderConfigTool = new SearchProviderConfigTool();

export async function executeCreateSearchProviderTool(
  step: any,
  _sessionId: string,
  context: { userId: string; conversationId: string }
): Promise<any> {
  const params = step.toolParams || {};
  
  const providerName = params.providerName || params.name || '';
  const apiUrl = params.apiUrl || params.url || '';
  const requestTemplate = params.requestTemplate;
  const responseTemplate = params.responseTemplate;
  const apiKeyRequired = params.apiKeyRequired;

  const result = await searchProviderConfigTool.createSearchProvider({
    providerName,
    apiUrl,
    requestTemplate,
    responseTemplate,
    apiKeyRequired,
    userId: context.userId
  });

  return {
    success: result.success,
    data: result.config,
    needApiKey: result.needApiKey,
    message: result.message,
    error: result.error
  };
}