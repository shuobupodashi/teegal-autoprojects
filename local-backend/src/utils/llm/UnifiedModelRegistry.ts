/**
 * 统一模型注册表
 *
 * 核心原则：
 * - 所有模型配置必须从用户的 user-models.json 加载
 * - SystemDefaultModel 只是用户体验功能，不参与业务流程
 * - 如果用户配置中没有找到模型，返回 null，不使用任何硬编码配置
 *
 * 数据来源：
 * - user-models.json: 用户自定义模型（唯一数据源）
 * - model-bindings.json: 绑定关系
 */

import { userModelRegistry, SimpleUserModel } from './UserModelRegistry';
import { modelBindingRegistry } from './ModelBindingRegistry';
import { OrganizationSubCategory, AssistantSubCategory } from './types';

export type SubCategoryType = OrganizationSubCategory | AssistantSubCategory;

export interface ModelCallConfig {
  url: string;
  apiKey: string;
  /** 🔥 套餐模型专用：云端 refreshToken，401 自愈刷新用（LLMService / CloudTokenRefresher） */
  refreshToken?: string;
  model: string;
  provider?: string;
  requestFormat?: 'openai' | 'dashscope' | 'responses';
  /** 🔥 用户声明的视觉能力（优先于前缀表推断，如 ox-alpha 等新模型） */
  supportsVision?: boolean;
}

export interface ResolvedModel {
  id: string;
  name: string;
  modelId: string;
  callConfig: ModelCallConfig;
}

class UnifiedModelRegistry {
  private initialized = false;

  initialize(): void {
    if (this.initialized) return;
    userModelRegistry.initialize();
    modelBindingRegistry.initialize();
    this.initialized = true;
    console.log('[UNIFIED-MODEL-REGISTRY] 初始化完成');
  }

  private toBindingKey(subCategory: SubCategoryType): string {
    const orgCategories = Object.values(OrganizationSubCategory);
    const assistantCategories = Object.values(AssistantSubCategory);

    if (orgCategories.includes(subCategory as OrganizationSubCategory)) {
      return `organization.${subCategory}`;
    } else if (assistantCategories.includes(subCategory as AssistantSubCategory)) {
      return `assistant.${subCategory}`;
    }
    return subCategory;
  }

  /**
   * 获取指定用途的模型配置
   *
   * 核心逻辑：
   * 1. 从 model-bindings.json 获取绑定的模型ID
   * 2. 从 user-models.json 加载模型配置（唯一数据源）
   * 3. 如果用户配置中没有，返回 null（不使用硬编码配置）
   */
  getModelForSubCategory(subCategory: SubCategoryType, userId?: string): ResolvedModel | null {
    this.initialize();

    // 未登录用户（没有 userId）返回 null
    if (!userId) {
      console.warn(`[UNIFIED-MODEL-REGISTRY] 未登录用户无法查找模型`);
      return null;
    }

    // 设置当前用户
    modelBindingRegistry.setCurrentUser(userId);
    userModelRegistry.setCurrentUser(userId);

    const bindingKey = this.toBindingKey(subCategory);

    const bindingModelId = modelBindingRegistry.getBinding(bindingKey, userId);

    if (!bindingModelId) {
      console.warn(`[UNIFIED-MODEL-REGISTRY] 未找到 ${bindingKey} 的模型绑定, userId: ${userId}`);
      return null;
    }

    // 从用户配置中加载模型（唯一数据源）
    const model = userModelRegistry.getUserModelById(bindingModelId, userId);

    if (!model) {
      console.warn(`[UNIFIED-MODEL-REGISTRY] 模型 ${bindingModelId} 不存在于用户配置中`);
      return null;
    }

    return this.toResolvedModel(model);
  }

  /**
   * 获取所有模型（从用户配置加载）
   */
  getAllModels(): SimpleUserModel[] {
    this.initialize();
    return userModelRegistry.getAllUserModels();
  }

  /**
   * 获取所有绑定关系
   */
  getAllBindings(): Record<string, string> {
    this.initialize();
    return modelBindingRegistry.getAllBindings();
  }

  /**
   * 设置绑定关系
   */
  setBinding(subCategory: SubCategoryType, modelId: string): void {
    this.initialize();
    const bindingKey = this.toBindingKey(subCategory);
    modelBindingRegistry.setBinding(bindingKey, modelId);
  }

  /**
   * 转换为用户模型配置
   */
  private toResolvedModel(model: SimpleUserModel): ResolvedModel {
    return {
      id: model.id,
      name: model.name,
      modelId: model.modelId,
      callConfig: {
        url: model.url,
        apiKey: model.apiKey,
        refreshToken: model.refreshToken,
        model: model.modelId,
        provider: model.provider,
        requestFormat: model.requestFormat,
        // 🔥 用户声明的视觉能力透传（SummaryModule 多模态判断用）
        supportsVision: model.supportsVision,
      },
    };
  }
}

export const unifiedModelRegistry = new UnifiedModelRegistry();
