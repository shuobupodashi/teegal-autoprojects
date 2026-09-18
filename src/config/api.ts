/**
 * API 配置 - 统一导出所有环境配置
 * 
 * 🔥 原则：所有配置从 env.ts 导入，这里只做导出和向后兼容
 */

// 🔥 从统一配置文件导入
export {
  PORTS,
  CLOUD_URLS,
  getLocalBackendPort,
  isElectron,
  getBackendUrl,
  getBackendApiUrl,
  getBackendWsUrl,
  getEnvInfo,
} from './env';

// 🔥 向后兼容：保留旧的导出名称（逐步迁移后可删除）
import {
  CLOUD_URLS,
  getBackendUrl,
  getBackendApiUrl,
  getLocalBackendPort,
} from './env';

/** @deprecated 使用 CLOUD_URLS.CLOUD_API 代替 */
export const CLOUD_API_BASE_URL = CLOUD_URLS.CLOUD_API;

/** @deprecated 使用 CLOUD_URLS.CLOUD 代替 */
export const CLOUD_BASE_URL = CLOUD_URLS.CLOUD;

/** @deprecated 使用 getBackendApiUrl() 代替 */
export const LOCAL_API_URL = `http://localhost:${getLocalBackendPort()}/api`;

/** @deprecated 使用 getBackendUrl() 代替 */
export const LOCAL_BASE_URL = `http://localhost:${getLocalBackendPort()}`;

/** @deprecated 使用 getBackendUrl() 代替 */
export const getEcsWorkerUrl = getBackendUrl;