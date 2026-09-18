/**
 * LLM 模型管理系统 - 类型定义（前端）
 */

/**
 * 模型大类
 */
export enum ModelMajorCategory {
  ORGANIZATION = 'organization',  // AI组织（Auto相关）
  ASSISTANT = 'assistant',        // AI助手（工具相关）
}

/**
 * 模型提供商
 */
export enum ModelProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  ALIBABA = 'alibaba',
  DEEPSEEK = 'deepseek',
  VOLCENGINE = 'volcengine',
  CUSTOM = 'custom',
}

/**
 * 模型定义
 */
export interface ModelDefinition {
  id: string;                       // 模型唯一ID
  name: string;                     // 模型显示名称
  provider: ModelProvider;          // 提供商
  majorCategory: ModelMajorCategory; // 大类别
  subCategory: string;              // 子类别
  modelId: string;                  // 实际的模型ID（如 gpt-4-turbo）
  description?: string;             // 模型描述
  maxTokens?: number;               // 最大token数
  supportedFeatures?: string[];     // 支持的特性（如 vision, function_calling）
  pricing?: {                       // 价格信息（可选）
    inputPer1k: number;
    outputPer1k: number;
  };
  isDefault?: boolean;              // 是否为该类别的默认模型
  enabled?: boolean;                // 是否启用
}

/**
 * 用户模型配置
 * 存储在 profiles 表的 llm_models 字段中
 */
export interface UserModelConfig {
  [key: string]: string;  // key: "majorCategory.subCategory", value: modelId
  
  // 示例：
  // "organization.main": "gpt-4-turbo-org-main"
  // "organization.summary": "gpt-3.5-turbo-org-summary"
  // "assistant.code": "deepseek-coder-assistant-code"
}

/**
 * 后端 API 响应类型
 */
export interface ModelsApiResponse {
  success: boolean;
  data?: {
    majorCategory: ModelMajorCategory;
    subCategories: string[];
    models: ModelDefinition[];
  };
  error?: string;
}

/**
 * 所有模型 API 响应类型
 */
export interface AllModelsApiResponse {
  success: boolean;
  data?: {
    organization: {
      majorCategory: ModelMajorCategory;
      subCategories: string[];
      models: ModelDefinition[];
    };
    assistant: {
      majorCategory: ModelMajorCategory;
      subCategories: string[];
      models: ModelDefinition[];
    };
  };
  error?: string;
}
