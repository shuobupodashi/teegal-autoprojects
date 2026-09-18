/**
 * Plan Reaction Loop 模块类型定义
 */

export interface FileInfo {
  id: string;
  name: string;
  type: string;
  mimeType?: string;
  size?: number;
  url?: string;
  storageUrl?: string;
  isUploaded?: boolean;
  uploadTimestamp?: number;
  fileAnalysisResult?: string;
}

export interface AutoContext {
  userId?: string;
  conversationId?: string;
  variables?: Record<string, any>;
  fileAnalysisResult?: string;
}

export interface AutoStep {
  id: string;
  title: string;
  description: string;
  type: "agent" | "tool" | "analysis" | "wait" | "user_input" | "branch";
  status?: "pending" | "executing" | "completed" | "failed" | "skipped";

  // 🔥 Reaction 架构字段（由 LLM 生成，用于动态选择工具）
  skillkeyword?: string;        // 技能关键词，用于工具筛选

  // 工具配置（如果type为tool，由Reaction阶段动态填充）
  toolName?: string;
  toolConfig?: any;
  toolParams?: Record<string, any>;

  outputs?: string[];

  // 执行信息
  executionResult?: any;
  error?: string;
  extensionCount?: number;  // 🔥 当前扩展深度（0表示主步骤）
  maxExtensions?: number;   // 🔥 最大扩展深度

  createdAt?: Date;
  updatedAt?: Date;
}

export interface AutoPlan {
  id: string;
  userQuery: string;
  hasplan?: boolean;

  // 🔥 给用户看的总结说明（支持 Markdown，可包含 Mermaid 流程图）
  say_to_user?: string;
  // 🔥 给 Agent 的详细执行指令（更精准）
  let_agent_todo?: string;

  steps: AutoStep[];
  currentStepIndex: number;
  status?: "planning" | "executing" | "completed" | "failed" | "paused";

  context?: AutoContext;

  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Thinking 结果类型（Summary 生成的执行指令）
 */
export interface ThinkingResult {
  let_agent_todo?: string;  // 执行指令
  say_to_user?: string;    // 给用户的消息
}

/**
 * 规划生成请求
 * 
 * 注意：环境信息（files、toolsSummary、agentCapabilities 等）统一通过 environmentText 传递
 */
export interface PlanGenerationRequest {
  userQuery: string;
  context?: Partial<AutoContext>;
  preferences?: {
    maxSteps?: number;
    preferredTools?: string[];
    avoidTools?: string[];
  };
  planId?: string;
  // 🔥 用户选择的模型ID（支持模型切换）
  selectedModelId?: string;
  // 🔥 Summary 生成的执行指令
  thinkingResult?: ThinkingResult;
  // 🔥 重试时的检查结果（简化版）
  previousCheckResult?: {
    say_to_user?: string;
    let_agent_todo?: string;
  };
  // 🔥 Plan 调整建议注入（多轮 Plan 优化）
  contextInjection?: string;
  // 🔥 Plan 调整进度信息
  planAdjustmentInfo?: {
    currentAdjustment: number;
    maxAdjustments: number;
    remainingAdjustments: number;
  };
  // 🔥 环境文本（由前端 EnvironmentBuilder 构建，包含 files/toolsSummary/agentCapabilities 等）
  environmentText?: string;
}

/**
 * 规划生成响应
 */
export interface PlanGenerationResponse {
  success: boolean;
  type?: "plan" | "error";
  plan?: AutoPlan;
  questions?: string[];
  partialAnalysis?: string;
  userQuery?: string;
  error?: string;
  suggestions?: string[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }; // 🔥 LLM Token 使用量
}

/**
 * 工具定义接口
 */
export interface ToolDefinition {
  name: string;
  displayName: string;
  description: string;
  parameters: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
  files?: {  // 🔥 将 availablefile 改为 files
    name: string;  // 参数名
    type: string;
    required: boolean;
    description: string;
  }[];
  skills?: string[];
  limitations?: string[];
  alternatives?: string[];
}

/**
 * 🔥 Reaction 工具选择请求
 */
export interface ToolSelectionRequest {
  // 🔥 环境文本（由前端 EnvironmentBuilder 构建，包含 userQuery、planReasoning 和 tools）
  environmentText: string;
  step: {
    id: string;
    description?: string;     // 步骤描述（后端 let_agent_todo 映射到此）
    skillkeyword?: string;    // 技能关键词
    extensionCount?: number;  // 🔥 当前扩展深度（0表示主步骤）
    maxExtensions?: number;   // 🔥 最大扩展深度
  };
  // 🔥 planReasoning 已包含在 environmentText 中，不再单独传递
  recommendedTools: ToolDefinition[]; // 🔥 推荐工具（必需的执行数据，不是环境数据）
  completedSteps: Array<{
    id: string;
    title?: string;        // 步骤标题
    toolName?: string;     // 执行的工具名称
    letMeTodo?: string;    // LLM 生成的行动描述
    status?: string;       // 步骤状态
  }>;
  stepOutputs: Record<string, any>;
  previousAttempts: Array<{
    toolName: string;
    error: string;
  }>;
  contextInjection?: string; // 🔥 背景注入字段（MCTS 决策后注入）
}

/**
 * 🔥 Reaction 工具选择响应
 */
export interface ToolSelectionResponse {
  success: boolean;
  toolName?: string;
  parameters?: any;
  files?: Record<string, string>;
  scaleStepSkillkeyword?: string;
  let_me_todo?: string;
  error?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}


