import { FileAttachment } from "@/components/workspace/types/ChatTypes";
import { UnifiedFileAttachment } from "@/utils/files";

/**
 * Auto模式核心类型定义
 */

export interface AutoStep {
  id: string;

  // 工具执行配置
  toolName?: string;
  toolParams?: Record<string, any>;
  toolFiles?: Record<string, FileAttachment[]>;  // 🔥 参数与文件分离传递，按参数名组织
  appId?: string;  // 🔥 新增：桌面应用ID，用于编辑现有应用

  // 执行结果
  result?: any;
  error?: string;

  // 🔥 LLM 生成的行动描述
  letMeTodo?: string;

  // 元数据
  createdAt: Date;
  [key: string]: any;  // 允许额外字段，保持兼容性
}



export interface AutoContext {
  // 文件上下文
  files: UnifiedFileAttachment[];
  fileMapping: Map<string, string>; // 原始路径 -> 统一路径映射

  // 执行上下文
  variables: Record<string, any>; // 步骤间共享变量
  outputs: Record<string, any>; // 步骤输出结果

  // 用户上下文
  userId?: string;
  conversationId?: string;

  // 🔥 新增：文件分析结果
  fileAnalysisResult?: string;

  // 🔥 新增：重试时的检查结果
  previousCheckResult?: {
    status: 'passed' | 'failed';
    say_to_user?: string;
    missingPoints?: string[];
    suggestion?: string;
  };

  // 执行配置
  maxRetries: number;
  timeout: number;
  autoRecover: boolean;
}

export interface AutoToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
  files?: FileAttachment[];
  statusCode?: number;
}

export interface RegisteredTool {
  name: string;
  description: string;
  type: "static" | "dynamic";
  category: "file" | "web" | "analysis" | "agent" | "utility";

  // 工具配置
  config: {
    parameters?: ToolParameter[];
    outputs?: string[];
    timeout?: number;
    retries?: number;
  };

  // 执行函数
  execute: (params: Record<string, any>, context: AutoContext) => Promise<AutoToolResult>;

  // 验证函数
  validate?: (params: Record<string, any>) => boolean;
}

export interface ToolParameter {
  name: string;
  type: "string" | "number" | "boolean" | "file" | "array" | "object";
  required: boolean;
  description?: string;
  default?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[];
  };
}

export interface AutoExecutionState {
  sessionId: string;
  executionLogs: AutoExecutionLog[];
  isProcessing: boolean;
}

export interface AutoExecutionLog {
  id: string;
  timestamp: Date;
  level: "info" | "warn" | "error" | "debug";
  stepId?: string;
  message: string;
  data?: any;
}




