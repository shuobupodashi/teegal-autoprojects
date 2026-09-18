/**
 * 环境配置 - 统一管理所有端口和环境变量
 * 
 * 🔥 原则：单一数据源，所有环境配置都在这里定义
 */

/**
 * 端口配置
 */
export const PORTS = {
  /** local-backend 开发环境端口 */
  LOCAL_BACKEND_DEV: 3002,
  /** local-backend 生产环境端口 */
  LOCAL_BACKEND_PROD: 3001,
  /** Vite 开发服务器端口 */
  VITE_DEV: 8080,
} as const;

/**
 * 云端服务地址
 * 🔥 通过 .env 的 VITE_HOME_WEB_URL 配置；未配置时使用官方托管地址
 */
export const CLOUD_URLS = {
  /** 云端服务基础地址 */
  CLOUD: import.meta.env.VITE_HOME_WEB_URL || 'https://workbees.space',
  /** 云端 API 地址（自动带 /api 前缀） */
  get CLOUD_API() { return `${this.CLOUD}/api`; },
} as const;

/**
 * 获取 local-backend 端口
 * - 开发环境: 3002
 * - 生产环境: 3001
 */
export const getLocalBackendPort = (): number => {
  return import.meta.env.DEV ? PORTS.LOCAL_BACKEND_DEV : PORTS.LOCAL_BACKEND_PROD;
};

/**
 * 检测是否在 Electron 环境中
 */
export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && (window as any).electron !== undefined;
};

/**
 * 获取 local-backend 基础 URL（不带 /api）
 * - Electron 环境: http://localhost:PORT
 * - 非 Electron 环境: 云端地址
 */
export const getBackendUrl = (): string => {
  if (isElectron()) {
    // 🔥 用 127.0.0.1 替代 localhost：避免 macOS 上 localhost 解析到 IPv6 ::1 导致连接失败
    return `http://127.0.0.1:${getLocalBackendPort()}`;
  }
  return CLOUD_URLS.CLOUD;
};

/**
 * 获取 local-backend API URL（带 /api）
 */
export const getBackendApiUrl = (): string => {
  return `${getBackendUrl()}/api`;
};

/**
 * 获取 local-backend WebSocket URL
 */
export const getBackendWsUrl = (): string => {
  if (isElectron()) {
    return `ws://127.0.0.1:${getLocalBackendPort()}`;
  }
  // 云端 WebSocket
  return CLOUD_URLS.CLOUD.replace('https://', 'wss://').replace('http://', 'ws://');
};

/**
 * 获取环境信息（用于调试）
 */
export const getEnvInfo = () => ({
  isElectron: isElectron(),
  isDev: import.meta.env.DEV,
  localBackendPort: getLocalBackendPort(),
  backendUrl: getBackendUrl(),
  backendApiUrl: getBackendApiUrl(),
  cloudUrl: CLOUD_URLS.CLOUD,
});