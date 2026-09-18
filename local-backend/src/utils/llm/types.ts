/**
 * LLM 模型注册表 - 类型定义
 */

export enum ModelMajorCategory {
  ORGANIZATION = 'organization',
  ASSISTANT = 'assistant',
}

export enum OrganizationSubCategory {
  SUMMARY = 'summary',
  PLAN = 'plan',
  EXECUTION = 'execution',
}

export enum AssistantSubCategory {
  CODE = 'code',
  IMAGE_GENERATION = 'image_gen',
  IMAGE_EDITING = 'image_edit',
  VIDEO_GENERATION = 'video_gen',
  RESEARCH = 'research',
  VISION = 'vision',
  SPEECH_RECOGNITION = 'speech_recognition',
}

export enum ModelProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  ALIBABA = 'alibaba',
  DEEPSEEK = 'deepseek',
  MOONSHOT = 'moonshot',
  VOLCENGINE = 'volcengine',
  CUSTOM = 'custom',
}

export interface ModelCallConfig {
  url: string;
  apiKey?: string;
  apiKeyEnvVar?: string;
  model: string;
  provider?: string;
  requestFormat?: 'openai' | 'dashscope' | 'responses';
}

export interface ModelDefinition {
  id: string;
  name: string;
  provider: ModelProvider;
  majorCategory: ModelMajorCategory;
  subCategory: string;
  modelId: string;
  description?: string;
  maxTokens?: number;
  supportedFeatures?: string[];
  pricing?: {
    inputPer1k: number;
    outputPer1k: number;
  };
  isDefault?: boolean;
  enabled?: boolean;
  callConfig: ModelCallConfig;
}

export interface UserModelConfig {
  [key: string]: string;
}
