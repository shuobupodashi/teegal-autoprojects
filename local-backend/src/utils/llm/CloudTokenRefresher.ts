/**
 * 套餐模型 JWT 401 自愈刷新器
 *
 * 背景：套餐模型以用户 JWT 为 apiKey 持久化在 user-models.json（快照），
 * JWT 7 天过期——后台链路（summary/plan/execution/ReAct）直读快照，
 * 过期后全量 401「令牌无效或已过期」。前端启动时刷新快照只是尽力而为
 * （app 长开不重启 / 启动刷失败一次 → 快照永久过期）。
 *
 * 本模块在【使用点】自愈：调用云端 llm-proxy 收到 401 时，
 * 用快照里附带的 refreshToken（30 天）向云端换新 token，
 * 更新本地所有套餐模型快照（apiKey + refreshToken，幂等），调用方重试原请求。
 *
 * 并发保护：多个请求同时 401 时只发起一次刷新（进程级 in-flight 去重）。
 */

import { userModelRegistry } from './UserModelRegistry';

/** 套餐模型 URL 标识：指向 home-web llm-proxy */
const CLOUD_PROXY_MARKER = '/api/llm-proxy/';

export interface CloudTokens {
  accessToken: string;
  refreshToken?: string;
}

export function isCloudProxyUrl(url?: string): boolean {
  return !!url && url.includes(CLOUD_PROXY_MARKER);
}

/** 进程级 in-flight 刷新保护 */
let refreshPromise: Promise<CloudTokens | null> | null = null;

/**
 * 尝试用 refreshToken 换新 token 并更新本地快照。
 * 成功返回新 token 对；任何失败返回 null（调用方放弃重试，透传原错误）。
 */
export async function refreshPackageToken(params: {
  url: string;
  refreshToken?: string;
}): Promise<CloudTokens | null> {
  if (!params.refreshToken || !isCloudProxyUrl(params.url)) return null;

  if (!refreshPromise) {
    refreshPromise = doRefresh(params).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function doRefresh(params: { url: string; refreshToken?: string }): Promise<CloudTokens | null> {
  try {
    const origin = new URL(params.url).origin;
    const resp = await fetch(`${origin}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: params.refreshToken }),
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      console.warn(`🔄 [CLOUD-TOKEN-REFRESHER] 刷新失败: ${resp.status}（refreshToken 可能已过期，需重新登录）`);
      return null;
    }

    const data: any = await resp.json();
    if (!data.success || !data.accessToken) {
      console.warn('🔄 [CLOUD-TOKEN-REFRESHER] 刷新响应异常:', JSON.stringify(data).substring(0, 200));
      return null;
    }

    const tokens: CloudTokens = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || params.refreshToken,
    };

    // 更新本地所有套餐模型快照（apiKey + refreshToken，幂等持久化）
    updatePackageSnapshots(tokens);
    console.log('✅ [CLOUD-TOKEN-REFRESHER] JWT 已自动续期并更新快照');
    return tokens;
  } catch (error) {
    console.warn('🔄 [CLOUD-TOKEN-REFRESHER] 刷新异常:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * 把新 token 写回当前用户的所有套餐模型记录（内存 + user-models.json）
 */
function updatePackageSnapshots(tokens: CloudTokens): void {
  const userId = userModelRegistry.getCurrentUserId();
  if (!userId) {
    console.warn('🔄 [CLOUD-TOKEN-REFRESHER] 无当前用户，跳过快照更新');
    return;
  }

  for (const model of userModelRegistry.getAllUserModels(userId)) {
    if (!isCloudProxyUrl(model.url)) continue;
    userModelRegistry.addOrUpdateModel(
      { ...model, apiKey: tokens.accessToken, refreshToken: tokens.refreshToken || model.refreshToken },
      userId
    );
  }
}
