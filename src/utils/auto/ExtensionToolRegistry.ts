/**
 * 🔥 扩展工具注册表（单例）
 *
 * 核心职责：
 * 1. 管理动态注册的工具模块（来自基础项目）
 * 2. 提供工具执行能力
 *
 * 工具来源：基础项目（system_base）的 tools/ 目录，由 BaseProjectToolLoader 加载
 * 工具格式：registry.json 登记元信息 + .js 文件为 execute 函数体
 */

import { ToolDefinition } from '@/utils/auto/AvailableToolsRegistry';

/**
 * 扩展工具模块接口
 */
export interface ExtensionToolModule {
  toolDefinition: ToolDefinition;
  execute: (params: Record<string, any>, context: ExtensionToolContext) => Promise<ExtensionToolResult>;
}

/**
 * 扩展工具执行上下文
 */
export interface ExtensionToolContext {
  userId: string;
  conversationId: string;
  userEmail?: string;
  projectId?: string;  // 🔥 基础项目 ID，供多文件工具 loadFile 使用
  llm?: {
    call: (params: {
      modelId?: string;
      purpose?: string;
      requestBody: any;
      stream?: boolean;
    }) => Promise<{
      success: boolean;
      content?: string;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model?: string;
      error?: string;
    }>;
    listModels: () => Promise<{
      success: boolean;
      models?: Array<{ id: string; name: string; modelId: string; provider: string; requestFormat?: string }>;
      error?: string;
    }>;
  };
  /**
   * 🔥 加载基础项目内的辅助文件（多文件工具用）
   * 返回辅助文件执行结果（辅助文件约定：return 出要导出的对象/函数）
   */
  loadFile?: (relativePath: string) => Promise<any>;
}

/**
 * 扩展工具执行结果
 */
export interface ExtensionToolResult {
  success: boolean;
  data?: any;
  error?: string;
  files?: string[];
}

/**
 * 🔥 扩展工具注册表 (单例)
 */
export class ExtensionToolRegistry {
  private static instance: ExtensionToolRegistry;

  // 已加载的工具模块
  private toolModules: Map<string, ExtensionToolModule> = new Map();

  // 工具定义缓存
  private toolDefinitions: Map<string, ToolDefinition> = new Map();

  private constructor() {}

  static getInstance(): ExtensionToolRegistry {
    if (!ExtensionToolRegistry.instance) {
      ExtensionToolRegistry.instance = new ExtensionToolRegistry();
    }
    return ExtensionToolRegistry.instance;
  }

  /**
   * 🔥 注册扩展工具
   * @param toolName 工具名称
   * @param module 工具模块
   */
  registerTool(toolName: string, module: ExtensionToolModule): void {
    this.toolModules.set(toolName, module);
    this.toolDefinitions.set(toolName, module.toolDefinition);
    console.log(`[ExtensionToolRegistry] 注册工具: ${toolName}`);
  }

  /**
   * 🔥 卸载扩展工具
   * @param toolName 工具名称
   */
  unregisterTool(toolName: string): void {
    this.toolModules.delete(toolName);
    this.toolDefinitions.delete(toolName);
    console.log(`[ExtensionToolRegistry] 卸载工具: ${toolName}`);
  }

  /**
   * 🔥 获取所有扩展工具定义
   */
  getAllToolDefinitions(): ToolDefinition[] {
    return Array.from(this.toolDefinitions.values());
  }

  /**
   * 🔥 获取特定工具定义
   */
  getToolDefinition(toolName: string): ToolDefinition | undefined {
    return this.toolDefinitions.get(toolName);
  }

  /**
   * 🔥 检查工具是否存在
   */
  hasTool(toolName: string): boolean {
    return this.toolModules.has(toolName);
  }

  /**
   * 🔥 执行扩展工具
   */
  async executeTool(
    toolName: string,
    params: Record<string, any>,
    context: ExtensionToolContext
  ): Promise<ExtensionToolResult> {
    const module = this.toolModules.get(toolName);
    if (!module) {
      return {
        success: false,
        error: `扩展工具 ${toolName} 未找到`,
      };
    }

    try {
      return await module.execute(params, context);
    } catch (error) {
      console.error(`[ExtensionToolRegistry] 执行工具 ${toolName} 失败:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '执行失败',
      };
    }
  }

  /**
   * 🔥 清空所有工具（重载时调用）
   */
  clear(): void {
    this.toolModules.clear();
    this.toolDefinitions.clear();
    console.log('[ExtensionToolRegistry] 已清空所有工具');
  }
}

// 导出单例实例
export const extensionToolRegistry = ExtensionToolRegistry.getInstance();
