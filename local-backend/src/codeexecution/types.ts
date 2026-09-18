export interface ExecutionRequest {
  code: string;
  language?: string;
  timeout?: number;
  maxMemory?: number;
  gpuNeeded?: boolean;
  gpuInstanceType?: string;
  gpuProvider?: string;
  requireGpuConfirmation?: boolean;
  taskId?: string;
  userId?: string;
  appId?: string;
  conversationId?: string;
  files?: any[];
  config?: {
    autoRun?: boolean;
    autoRunInterval?: number;
    env_vars?: Record<string, string>;
  };
  // 🔥 新增：多文件支持
  isMultiFile?: boolean;
  codePackage?: string;     // base64 编码的打包文件
  entryPoint?: string;      // 入口文件，如 "main.py"
  mainFile?: string;        // 主文件名
}

export interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string | null;
  executionTime: number;
  executionMode: 'container' | 'gpu' | 'local';
  charts?: any[];
  files?: { [filename: string]: any };
  actions?: any[];
  preview?: any;
  gpuNeeded?: boolean;
  estimatedCost?: number;
  estimatedDuration?: number;
  gpuInstanceId?: string;
  gpuStatus?: 'pending' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  errorCode?: string; // 🔥 透传底层错误码
  startTime?: string; // 任务开始时间
  endTime?: string;   // 任务结束时间
  actualDuration?: number; // 实际执行时长 (秒)
  gpuInstanceType?: string; // 🔥 记录实际使用的实例规格
  gpuModelName?: string;     // 🔥 记录显卡型号名称 (如 T4)
  taskId?: string;           // 🔥 新增：返回任务 ID
  message?: string;          // 🔥 新增：执行状态消息
  // 🔥 新增：失败原因分类，帮助 LLM 区分不同失败情况
  failureReason?: 'instance_unavailable' | 'execution_error' | 'timeout' | 'network_error' | 'unknown';
  instanceCreated?: boolean; // 🔥 新增：是否成功创建了 GPU 实例
}

export interface GPUInstanceConfig {
  instanceType: string; // GPU实例类型，如 'ecs.gn6i-c8g1.2xlarge'
  regionId: string;     // 区域ID，如 'cn-hangzhou'
  zoneId?: string;      // 可选的可用区ID
  imageId: string;      // 镜像ID
  securityGroupId: string; // 安全组ID
  vSwitchId: string;    // 虚拟交换机ID
}