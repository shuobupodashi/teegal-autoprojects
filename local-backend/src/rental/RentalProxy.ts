/**
 * SSH 租赁云端代理
 *
 * 转发本地 /api/rental/* → 云端 /api/rental/v1/*（home-web/server 独立租赁模块）。
 * 双轨认证与 HostedProxyProvider 同模型：优先用户 JWT（个人余额扣费），
 * fallback GPU_WORKER_SECRET；401 时用 refreshToken 自愈续期重试一次。
 */

import { userModelRegistry } from '../utils/llm/UserModelRegistry';
import { isCloudProxyUrl, refreshPackageToken } from '../utils/llm/CloudTokenRefresher';

const CLOUD_BASE = (process.env.HOME_WEB_URL || 'https://www.workbees.space').replace(/\/$/, '');
const WORKER_SECRET = process.env.GPU_WORKER_SECRET || '';

function getUserJwt(): { accessToken: string; refreshToken?: string } | null {
  const userId = userModelRegistry.getCurrentUserId();
  if (!userId) return null;
  for (const model of userModelRegistry.getAllUserModels(userId)) {
    if (isCloudProxyUrl(model.url) && model.apiKey) {
      return { accessToken: model.apiKey, refreshToken: model.refreshToken };
    }
  }
  return null;
}

/** 统一请求云端 /api/rental/v1/* */
export async function rentalRequest<T = any>(
  method: string,
  apiPath: string,
  body?: any,
  timeoutMs = 30000,
  retried = false
): Promise<T> {
  const userJwt = getUserJwt();
  const useWorkerSecret = !userJwt?.accessToken;

  if (useWorkerSecret && !WORKER_SECRET) {
    throw new Error('未登录（SSH 租赁需用户登录令牌）且 GPU_WORKER_SECRET 未配置');
  }

  const response = await fetch(`${CLOUD_BASE}/api/rental/v1${apiPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${useWorkerSecret ? WORKER_SECRET : userJwt!.accessToken}`
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs)
  });

  const data: any = await response.json().catch(() => null);
  if (!response.ok) {
    // 用户 JWT 过期 → 401 自愈续期重试一次（与 llmProxy 同链路）
    if (response.status === 401 && !useWorkerSecret && !retried && userJwt?.refreshToken) {
      const tokens = await refreshPackageToken({
        url: `${CLOUD_BASE}/api/llm-proxy/call`,
        refreshToken: userJwt.refreshToken
      });
      if (tokens?.accessToken) {
        return rentalRequest<T>(method, apiPath, body, timeoutMs, true);
      }
    }
    const err: any = new Error(data?.error || `HTTP ${response.status}`);
    err.statusCode = response.status;
    throw err;
  }
  return data as T;
}
