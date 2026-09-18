/**
 * GPU 云厂商抽象接口
 *
 * hosted 模式：本地零渠道概念，规格/价格表唯一权威在 home-web/server，
 * 本地通过 HostedProxyProvider.fetchSpecs() 拉取缓存（specs 已含 provider 字段）。
 */

/**
 * GPU 规格（每个记录代表一个云厂商的一个实例规格）
 */
export interface GpuSpec {
  provider: string;                // 云厂商（云端下发：'aliyun' | 'tencent'）
  gpuType: string;                 // GPU 型号（T4/A10/V100/A100/H100 等）
  gpuCount: number;                // GPU 卡数：1, 2, 4
  vcpuCount: number;               // CPU 核数
  memoryGB: number;                // 内存大小 (GB)
  instanceType: string;            // 实例类型 ID（阿里云 ecs.* / 腾讯云 GN7.* 等）
  pricePerHour: number;            // 每小时价格（元，按量付费）
}

/**
 * 价格信息
 */
export interface PriceInfo {
  pricePerHour: number;      // 每小时价格（元）
  spotPrice?: number;        // 竞价实例价格（更便宜）
  available: boolean;        // 当前是否有库存
  region: string;            // 区域
  zone?: string;             // 可用区
  lastUpdated?: Date;        // 价格更新时间
}

/**
 * 实例配置
 */
export interface InstanceConfig {
  spec: GpuSpec;
  taskId: string;
  containerImage?: string;   // 🔥 改为可选，Provider 有自己的默认值
  command?: string;
  envVars?: Record<string, string>;
  autoStopAfter?: number;    // 自动停止时间（秒）
  probeMode?: boolean;       // 探测模式，不计费
  ossPath?: string;          // OSS 输出路径
  userId?: string;           // 🔥 hosted 代理：云端扣费需要用户标识
  appId?: string;            // 🔥 hosted 代理：云端任务登记需要应用标识
}

/**
 * 实例状态
 */
export type InstanceStatus = 
  | 'pending'    // 创建中
  | 'starting'   // 启动中
  | 'running'    // 运行中
  | 'stopping'   // 停止中
  | 'stopped'    // 已停止
  | 'failed'     // 失败
  | 'unknown'    // 未知
  | 'network-error'; // 🔥 网络错误（特殊状态，用于容错机制）

/**
 * 实例创建结果
 */
export interface InstanceResult {
  success: boolean;
  instanceId?: string;
  region?: string;  // 实例所在区域（跨区域创建时需要）
  zone?: string;    // 实例所在可用区
  error?: string;
  errorCode?: string;
  actualPrice?: number;
  status?: InstanceStatus;
}

/**
 * 云厂商凭证
 */
export interface CloudCredentials {
  accessKeyId?: string;
  accessKeySecret?: string;
  secretId?: string;
  secretKey?: string;
  region?: string;
  appId?: string;
  // 腾讯云 COS 凭证
  cosBucket?: string;
  cosRegion?: string;
  cosSecretId?: string;
  cosSecretKey?: string;
  // 阿里云 OSS 凭证
  ossBucket?: string;
  ossRegion?: string;
  ossAccessKeyId?: string;
  ossAccessKeySecret?: string;
}

/**
 * 实例执行结果（等待完成后返回）
 */
export interface ExecutionCompletionResult {
  success: boolean;
  output?: string;
  error?: string;
  // 🔥 hosted 代理：云端已结算的真实时长/费用，本地镜像（undefined 时本地自行计算）
  duration?: number;
  cost?: number;
}

/**
 * GPU 实例可用性信息
 */
export interface GpuAvailabilityInfo {
  instanceType: string;   // 实例类型（如 GN7.2XLARGE32）
  region: string;         // 区域（如 ap-nanjing）
  zone?: string;          // 可用区（如 ap-nanjing-3）
  available: boolean;     // 是否有库存
  statusCategory?: string; // 🔥 库存状态（WithStock/WithoutStock/ClosedWithStock）
  provider?: string;      // 🔥 云端聚合时已标记来源厂商，本地直接分组用
}

/**
 * 🔥 hosted 代理：云端存储信息（非密；本地 GpuWrapper 组装 job bundle 做 URL 内网化用）
 */
export interface HostedStorageInfo {
  ossBucket?: string;
  ossRegion?: string;
  cosBucket?: string;
  cosRegion?: string;
  appId?: string;
}

/**
 * GPU 云厂商抽象接口
 */
export interface GpuCloudProvider {
  // 唯一标识
  readonly name: string;           // 'aliyun' | 'tencent'
  readonly displayName: string;    // '阿里云' | '腾讯云'

  // 🔥 任务成功后等待对象存储最终一致的秒数（各厂商一致性延迟不同，调度器统一使用）
  readonly fileSyncWaitSeconds: number;

  // 核心能力
  queryPrice(spec: GpuSpec): Promise<PriceInfo>;
  createInstance(config: InstanceConfig): Promise<InstanceResult>;
  queryStatus(instanceId: string, region?: string): Promise<InstanceStatus>;
  stopInstance(instanceId: string, region?: string): Promise<{ success: boolean; error?: string }>;
  // 🔥 新增 abortSignal 参数，用于通知 waitForCompletion 停止轮询
  waitForCompletion(
    instanceId: string,
    maxWaitTime?: number,
    onStatusChange?: (status: InstanceStatus) => void,
    region?: string,
    abortSignal?: AbortSignal
  ): Promise<ExecutionCompletionResult>;
  fetchLogs(instanceId: string, region?: string): Promise<string>;

  // 可用性检查
  checkAvailability(spec: GpuSpec): Promise<boolean>;

  // 🔥 批量查询所有 GPU 实例的可用性（按区域查询）
  checkAllAvailability?(): Promise<GpuAvailabilityInfo[]>;

  // 凭证管理
  setCredentials(credentials: CloudCredentials): void;
  getCredentials(): CloudCredentials | null;

  // 🔥 将 home-web 下发的原始凭证映射为本厂商的凭证结构
  // （调度器不感知各厂商凭证字段差异；region 为任务实例所在区域，可缺省由厂商自行降级）
  mapFetchedCredentials(raw: any, region?: string): CloudCredentials;

  // 🔥 判断实例 ID 是否属于本厂商（恢复/停止任务时由调度器据此定位 provider）
  ownsInstance(instanceId: string): boolean;

  // 🔥 新增：生成对象存储签名URL
  // 每个云厂商实现自己的签名逻辑（阿里云OSS、腾讯云COS）
  generatePresignedUrl(objectKey: string): string;

  // 🔥 hosted 代理：直接返回云端完整价格选项（含各厂商名称），普通 provider 不实现
  fetchAllPriceOptions?(): Promise<GpuSelectionOption[]>;

  // 🔥 hosted 代理：返回云端存储信息（bucket/region/appId 非密），普通 provider 不实现
  fetchStorageInfo?(): Promise<HostedStorageInfo>;

  // 支持的规格列表
  getSupportedSpecs(): GpuSpec[];
}

/**
 * GPU 选择选项（用于前端展示）
 */
export interface GpuSelectionOption {
  provider: string;           // 厂商名称
  providerDisplayName: string; // 厂商显示名称
  spec: GpuSpec;
  price: PriceInfo;
  recommended?: boolean;      // 是否推荐
  availabilityStatus: 'available' | 'limited' | 'unavailable';
}