/**
 * 🔥 BootCode 基础项目加载器（base-bootcode）
 *
 * 与扩展工具基础项目（BaseProjectToolLoader）同套路，但初始化方式不同：
 * 不用种子文件，而是从开源仓库（teegal-autoprojects）拉取完整源码——
 * 让 rootcode 本身对用户可见：用户在项目列表里就能看到本系统的全部源代码，
 * 可自由阅读和修改，这就是"自己写自己的 Agent"的入口。
 *
 * 拉取方式：复用 FileTree 的 executeGitClone（git clone --depth 1，与
 * CloneButton 同一条链路，单一 clone 实现不重复造轮子）。
 * 仓库落在项目子目录 teegal-autoprojects/ 下，带 .git，用户后续可 pull 更新。
 *
 * 网络容错（国内访问 GitHub 不稳定是常态）：
 * 1. 源降级：官方源失败 → 国内镜像源逐个尝试
 * 2. 退避重试：本次会话内 1min → 5min → 30min → 60min 各重试一次（重试时重新检测，
 *    用户若已手动拉过则直接跳过）
 * 3. 全部失败：本次会话放弃，下次启动重新走这套机制
 *
 * 职责：
 * 1. 确保用户拥有 BootCode 项目（不存在则创建，app_type=system_base）
 * 2. 初始化检测：子目录 teegal-autoprojects/ 缺失 → 自动 git clone
 * 3. 失败按上述容错策略补偿，全程静默不阻塞启动
 */

import { desktopAppStorage } from '@/services/storage';
import { desktopAppEventService } from '@/services/events/DesktopAppEventService';
import { mapDbAppToDesktopApp } from '@/utils/workspace/desktopAppUtils';
import { executeGitClone } from '@/components/workspace/DesktopModule/FileTree/hooks/useGitClone';

/**
 * 🔥 BootCode 项目固定 ID（与后端 DesktopAppDAO.BOOT_PROJECT_ID 一致）
 */
export const BOOT_PROJECT_ID = 'base-bootcode';

/**
 * 🔥 源列表：官方源在前，国内镜像兜底（镜像同步延迟可接受，浅克隆只拿最新代码）
 */
const BOOT_REPO_SOURCES = [
  'https://github.com/shuobupodashi/teegal-autoprojects.git',
  'https://gitclone.com/github.com/shuobupodashi/teegal-autoprojects.git',
];
const BOOT_REPO_DIR = 'teegal-autoprojects';

/**
 * 🔥 退避重试延迟（失败后依次延迟重试；耗尽后本次会话放弃，下次启动重来）
 */
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 60 * 60_000];

/**
 * 后端 API 基址（与 BaseProjectToolLoader 一致）
 */
function getApiBase(): string {
  return import.meta.env.DEV
    ? '/api/ecs-worker/api/local'
    : 'http://localhost:3001/api/local';
}

/**
 * 🔥 确保用户拥有 BootCode 项目（调后端 API）
 */
async function ensureBootProjectInternal(userId: string): Promise<{ appId: string; created: boolean }> {
  const res = await fetch(`${getApiBase()}/desktop-apps/boot-project/ensure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) {
    throw new Error(`ensureBootProject 失败: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return { appId: json.data.id as string, created: json.created === true };
}

/**
 * 🔥 检查项目内容是否已初始化（以子目录中的 README.md 为标志）
 */
async function isBootProjectInitialized(appId: string): Promise<boolean> {
  const electron = (window as any).electron;
  if (!electron?.checkAppCodeFileExists) return true; // 无法检测时按已初始化处理（避免重复 clone）
  try {
    const result = await electron.checkAppCodeFileExists({
      appId,
      fileName: `${BOOT_REPO_DIR}/README.md`,
    });
    return result?.exists === true;
  } catch {
    return true;
  }
}

/**
 * 🔥 会话内状态：幂等标记 + 重试调度（页面刷新即重置，天然"下次启动重新开始"）
 */
let _initializedUserId: string | null = null;
let _retryAttempt = 0;                    // 已消耗的重试次数
let _retryTimer: ReturnType<typeof setTimeout> | null = null;

function clearRetryTimer(): void {
  if (_retryTimer) {
    clearTimeout(_retryTimer);
    _retryTimer = null;
  }
}

/**
 * 🔥 按源列表依次尝试 clone（官方失败试镜像，任一成功即止）
 */
async function attemptCloneFromSources(appId: string): Promise<{ success: boolean; error?: string }> {
  let lastError = '未知错误';
  for (const repoUrl of BOOT_REPO_SOURCES) {
    const sourceName = repoUrl.includes('gitclone.com') ? '国内镜像' : '官方源';
    console.log(`[BootProjectLoader] 尝试从${sourceName}拉取: ${repoUrl}`);
    const result = await executeGitClone(
      { repoUrl, appId, shallow: true, targetPath: BOOT_REPO_DIR },
      (msg) => console.log(`[BootProjectLoader] ${msg}`)
    );
    if (result.success) return result;
    lastError = result.error || lastError;
    console.warn(`[BootProjectLoader] ${sourceName}拉取失败:`, lastError);
  }
  return { success: false, error: lastError };
}

/**
 * 🔥 调度一次退避重试；重试额度耗尽则放弃（等下次启动）
 */
function scheduleRetry(userId: string): void {
  if (_retryAttempt >= RETRY_DELAYS_MS.length) {
    console.warn('[BootProjectLoader] 本次会话重试额度已用完，放弃拉取（下次启动自动重新尝试）');
    return;
  }
  const delay = RETRY_DELAYS_MS[_retryAttempt];
  _retryAttempt++;
  const minutes = Math.round(delay / 60000);
  console.log(`[BootProjectLoader] 将在 ${minutes} 分钟后进行第 ${_retryAttempt}/${RETRY_DELAYS_MS.length} 次重试`);
  clearRetryTimer();
  _retryTimer = setTimeout(() => {
    _retryTimer = null;
    _initializedUserId = null; // 清幂等标记，允许完整流程重跑（attempt 计数由本函数管理）
    loadBootProject(userId).catch(() => {});
  }, delay);
}

/**
 * 🔥 主入口：初始化 BootCode 项目（幂等，fire-and-forget，不阻塞启动）
 * 1. 确保项目存在（新建时广播列表刷新）
 * 2. 仓库子目录缺失 → 按源列表拉取（官方 → 镜像）
 * 3. 失败 → 退避重试（1min/5min/30min/60min），耗尽后本次会话放弃
 */
export async function loadBootProject(userId: string): Promise<void> {
  if (!userId) return;
  // 用户切换：清重试调度，重新开始
  if (_initializedUserId && _initializedUserId !== userId) {
    clearRetryTimer();
    _retryAttempt = 0;
    _initializedUserId = null;
  }
  // 幂等：同一用户只执行一次（重试回调会先清标记再重入）
  if (_initializedUserId === userId) return;
  _initializedUserId = userId;

  try {
    // 1. 确保项目存在（幂等）
    const { appId, created } = await ensureBootProjectInternal(userId);

    // 2. 新建的实时补进项目列表（与扩展工具项目同款广播）
    if (created) {
      try {
        const raw = await desktopAppStorage.getById(appId);
        if (raw) {
          desktopAppEventService.emitAppCreated(appId, userId, mapDbAppToDesktopApp(raw));
          console.log(`[BootProjectLoader] BootCode 项目已创建并广播列表刷新: ${appId}`);
        }
      } catch (e) {
        console.warn('[BootProjectLoader] 广播 BootCode 项目创建事件失败:', e);
      }
    }

    // 3. 已有内容则跳过（用户资产保护：绝不重复 clone 覆盖；手动拉过也走这里）
    if (await isBootProjectInitialized(appId)) {
      clearRetryTimer();
      _retryAttempt = 0;
      return;
    }

    // 4. 拉取开源仓库（官方源 → 国内镜像逐个尝试）
    console.log('[BootProjectLoader] 开始拉取开源仓库源码到 BootCode 项目...');
    const result = await attemptCloneFromSources(appId);
    if (result.success) {
      console.log('[BootProjectLoader] BootCode 项目初始化完成');
      clearRetryTimer();
      _retryAttempt = 0;
    } else {
      console.warn('[BootProjectLoader] 开源仓库拉取失败:', result.error);
      scheduleRetry(userId);
    }
  } catch (e) {
    console.warn('[BootProjectLoader] BootCode 项目初始化失败:', e);
    scheduleRetry(userId);
  }
}
