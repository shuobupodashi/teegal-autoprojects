/**
 * 🔥 基础项目工具加载器
 *
 * 核心职责：
 * 1. 确保用户拥有基础项目（system_base），不存在则创建
 * 2. 初始化种子文件（tools/registry.json + 示例工具）
 * 3. 从 registry.json 读取工具登记，编译 .js 文件为可执行函数
 * 4. 注册到 ExtensionToolRegistry，让 ToolHandler 能调度
 *
 * 工具文件格式（.js）：
 *   纯函数体，作用域内有 params（参数对象）和 context（执行上下文）
 *   不能用 import，依赖的能力从 context 取（electron/fetch/llm/loadFile）
 *
 * registry.json 格式：
 *   { "tools": [{ "name", "file", "description", "tokens", "params" }] }
 */

import { extensionToolRegistry, ExtensionToolContext, ExtensionToolResult } from './ExtensionToolRegistry';
import { registerTool, unregisterTool } from './AvailableToolsRegistry';
// unregisterTool 用于热重载时注销已删除的工具
import { desktopAppStorage } from '@/services/storage';
import { mapDbAppToDesktopApp } from '@/utils/workspace/desktopAppUtils';
import { desktopAppEventService } from '@/services/events/DesktopAppEventService';

// AsyncFunction 构造器，用于编译工具代码字符串
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

/**
 * 🔥 基础项目固定 ID：本地库按用户隔离，LLM 无需知道 userId 即可直接引用
 * 与后端 DesktopAppDAO.BASE_PROJECT_ID 保持一致
 * 命名带用途（extensiontool），后续新增其他类型基础项目不会冲突
 */
export const BASE_PROJECT_ID = 'base-extensiontool';

/**
 * 后端 API 基址
 */
function getApiBase(): string {
  return import.meta.env.DEV
    ? '/api/ecs-worker/api/local'
    : 'http://localhost:3001/api/local';
}

/**
 * 🔥 确保用户拥有基础项目（调后端 API）
 * 内部实现：返回 appId + created（本次是否新建，用于广播列表刷新）
 */
async function ensureBaseProjectInternal(userId: string): Promise<{ appId: string; created: boolean }> {
  const res = await fetch(`${getApiBase()}/desktop-apps/base-project/ensure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) {
    throw new Error(`ensureBaseProject 失败: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return { appId: json.data.id as string, created: json.created === true };
}

/**
 * 🔥 确保用户拥有基础项目（调后端 API）
 * 返回基础项目的 appId
 */
export async function ensureBaseProject(userId: string): Promise<string> {
  const { appId } = await ensureBaseProjectInternal(userId);
  return appId;
}

/**
 * 🔥 读取基础项目内的文件
 */
async function readProjectFile(appId: string, filePath: string): Promise<string | null> {
  const electron = (window as any).electron;
  if (!electron?.readAppCodeFile) return null;
  try {
    const result = await electron.readAppCodeFile({ appId, fileName: filePath });
    if (result?.success) return result.content;
    return null;
  } catch {
    return null;
  }
}

/**
 * 🔥 写入基础项目文件
 */
async function saveProjectFile(appId: string, filePath: string, content: string): Promise<boolean> {
  const electron = (window as any).electron;
  if (!electron?.saveAppCodeFile) return false;
  try {
    const result = await electron.saveAppCodeFile({ appId, fileName: filePath, content });
    return result?.success === true;
  } catch {
    return false;
  }
}

/**
 * 🔥 检查文件是否存在
 */
async function checkFileExists(appId: string, filePath: string): Promise<boolean> {
  const electron = (window as any).electron;
  if (!electron?.checkAppCodeFileExists) return false;
  try {
    const result = await electron.checkAppCodeFileExists({ appId, fileName: filePath });
    return result?.exists === true;
  } catch {
    return false;
  }
}

/**
 * 🔥 种子 README.md：项目说明，方便 LLM 通过 read_project_file 理解项目用途
 */
const SEED_README = `# 扩展工具项目

这是系统级基础项目（app_type=system_base），是用户的个人资产：存放 LLM 动态创建的工具。

## 规则
- 本项目 projectId 固定为 base-extensiontool，直接使用，无需查询
- 本项目不可删除，只能修改其中的文件
- 系统更新不会覆盖本项目内已有的文件（每个文件只在缺失时补种）
- 用户可自由修改本项目内任何文件，加入自己的逻辑和工具

## 目录结构
- README.md             本说明文件
- tools/registry.json   工具注册表（网关）：只有在这里登记的工具才会被加载
- tools/*.js            工具执行代码（纯函数体）

## 如何创建工具
1. 用 save_project_file 创建 tools/你的工具名.js（格式见 tools/example.js）
2. 用 read_project_file 读取 tools/registry.json
3. 用 save_project_file 更新 registry.json，加入登记项
4. 保存 registry.json 后工具立即热加载生效，可直接调用

## 工具编写规范
- 不要写死循环或长时间同步阻塞（会卡住界面）
- 网络请求设置合理超时，长任务考虑分片
- 工具执行有 20 分钟系统超时限制，超时返回错误；长任务应分片执行或设计为可断点续跑
- 返回小而精的结果（{success, data}），不要返回超大对象

工具 .js 文件格式：纯函数体（不用 import），作用域内有 params（参数对象）和 context（执行上下文：userId/conversationId/llm.call/llm.listModels/loadFile）。
多文件工具：辅助文件用 context.loadFile('子目录/helper.js') 加载，辅助文件约定 return 出导出内容。
`;

/**
 * 🔥 种子 registry.json
 */
const SEED_REGISTRY = JSON.stringify({
  tools: [],
}, null, 2);

/**
 * 🔥 种子示例工具
 */
const SEED_EXAMPLE = `// 示例工具：向用户打招呼
// 作用域内可用：params（参数对象）、context（执行上下文，含 electron/fetch/llm/loadFile）
const name = params.name || '世界';
return {
  success: true,
  data: { greeting: '你好，' + name + '！' }
};
`;

/**
 * 🔥 逐文件补种：只写缺失的文件，绝不覆盖用户已有的（成熟用户资产保护）
 * 系统升级新增种子文件时，老用户也能自动补上（如 README.md）
 */
async function seedBaseProjectFiles(appId: string): Promise<void> {
  const seeds: Array<[string, string]> = [
    ['README.md', SEED_README],
    ['tools/registry.json', SEED_REGISTRY],
    ['tools/example.js', SEED_EXAMPLE],
  ];
  for (const [filePath, content] of seeds) {
    try {
      const exists = await checkFileExists(appId, filePath);
      if (!exists) {
        await saveProjectFile(appId, filePath, content);
        console.log(`[BaseProjectToolLoader] 已补种缺失文件: ${filePath}`);
      }
    } catch (e) {
      console.warn(`[BaseProjectToolLoader] 补种 ${filePath} 失败:`, e);
    }
  }
}

/**
 * 🔥 registry.json 的工具登记项
 */
interface RegistryEntry {
  name: string;
  file: string;
  description?: string;
  tokens?: string[];
  params?: string;
}

/**
 * 🔥 从 registry.json 加载并注册所有工具
 * 单工具加载失败不影响其他工具
 */
async function loadToolsFromRegistry(appId: string): Promise<number> {
  const registryContent = await readProjectFile(appId, 'tools/registry.json');
  if (!registryContent) {
    console.log('[BaseProjectToolLoader] 无 registry.json，跳过工具加载');
    return 0;
  }
  // 🔥 记录本次加载的 registry 内容快照（fs.watch 内容级去重用）
  _baseAppId = appId;
  _lastRegistryContent = registryContent;

  let registry: { tools: RegistryEntry[] };
  try {
    registry = JSON.parse(registryContent);
  } catch (e) {
    console.warn('[BaseProjectToolLoader] registry.json 解析失败:', e);
    return 0;
  }

  if (!registry.tools || !Array.isArray(registry.tools)) {
    console.log('[BaseProjectToolLoader] registry.tools 为空或非数组');
    return 0;
  }

  let loaded = 0;
  let missingFiles = 0;
  for (const entry of registry.tools) {
    try {
      if (!entry.name || !entry.file) {
        console.warn(`[BaseProjectToolLoader] 跳过无效登记项:`, entry);
        continue;
      }

      // 读工具代码
      const code = await readProjectFile(appId, `tools/${entry.file}`);
      if (!code) {
        missingFiles++;
        console.warn(`[BaseProjectToolLoader] 工具 ${entry.name} 的文件 ${entry.file} 不存在`);
        continue;
      }

      // 用 AsyncFunction 编译：作用域注入 params 和 context
      const executeFn = new AsyncFunction('params', 'context', code);

      // 注册到 ExtensionToolRegistry
      extensionToolRegistry.registerTool(entry.name, {
        toolDefinition: {
          name: entry.name,
          description: entry.description,
          tokens: entry.tokens as any,
          params: entry.params,
        },
        execute: (params: Record<string, any>, context: ExtensionToolContext): Promise<ExtensionToolResult> => {
          return executeFn(params, context);
        },
      });

      // 注册到 AvailableToolsRegistry（让 LLM 可见）
      registerTool({
        name: entry.name,
        description: entry.description,
        tokens: entry.tokens as any,
        params: entry.params,
      });

      loaded++;
      console.log(`[BaseProjectToolLoader] 已加载工具: ${entry.name}`);
    } catch (e) {
      // 单工具失败不影响其他
      console.warn(`[BaseProjectToolLoader] 工具 ${entry.name} 加载失败:`, e);
    }
  }

  // 🔥 兜底：登记了但文件缺失（如 shell 先改 registry 后写工具文件的反序场景），
  // registry 已触发过重载、之后文件落盘不再有事件 → 3 秒后补一次重试（单次，防循环）
  if (missingFiles > 0 && !_missingRetryScheduled && _initializedUserId) {
    _missingRetryScheduled = true;
    setTimeout(() => {
      _missingRetryScheduled = false;
      if (_initializedUserId) {
        console.log('[BaseProjectToolLoader] 存在缺失的工具文件，延迟重试加载');
        loadBaseProjectTools(_initializedUserId, true).catch(() => {});
      }
    }, 3000);
  }
  return loaded;
}

/**
 * 🔥 幂等去重：同一 userId 的加载只执行一次（Promise 缓存）
 * ChatHeader 启动初始化 / ToolHandler 构造 / 其他调用方重复调用均安全
 * 失败时重置缓存，允许下次重试
 */
let _initializedUserId: string | null = null;
let _initPromise: Promise<number> | null = null;
// 🔥 缺失工具文件的延迟重试标记（防循环：重试期间不再排下一次）
let _missingRetryScheduled = false;

/**
 * 🔥 文件系统级热重载：订阅主进程 fs.watch 广播（只广播 registry.json 变更）
 * 覆盖任何写入方式（userpc_shell、外部编辑器等），弥补工具钩子路径之外的盲区。
 * 内容级去重：registry 内容与上次加载时相同（重写未变/与钩子重载重复）则跳过。
 */
let _fsWatchSubscribed = false;
let _baseAppId: string | null = null;
let _lastRegistryContent: string | null = null;

function subscribeFsWatchReload(): void {
  if (_fsWatchSubscribed) return;
  const electron = (window as any).electron;
  if (!electron?.onBaseToolsChanged) return; // 非 Electron 环境跳过
  _fsWatchSubscribed = true;
  electron.onBaseToolsChanged(async () => {
    if (!_initializedUserId || !_baseAppId) return;
    try {
      const content = await readProjectFile(_baseAppId, 'tools/registry.json');
      if (content === _lastRegistryContent) return; // 内容没变，无需重载
    } catch { /* 读取失败时按需重载 */ }
    console.log('[BaseProjectToolLoader] 检测到 registry.json 变更（fs.watch），自动热重载');
    loadBaseProjectTools(_initializedUserId, true).catch(() => {});
  });
}

/**
 * 🔥 主入口：加载基础项目的所有工具（幂等）
 * 1. 确保基础项目存在（不存在则创建，已有则用用户的——资产保护）
 * 2. 逐文件补种缺失的种子文件（README/registry.json/example，绝不覆盖已有）
 * 3. 加载注册表中的工具
 *
 * @param userId 用户 ID
 * @param force 强制重载（热加载：LLM 改完 registry.json/工具文件后立即生效，无需刷新页面）
 * @returns 已加载工具数
 */
export function loadBaseProjectTools(userId: string, force = false): Promise<number> {
  if (!userId) {
    console.warn('[BaseProjectToolLoader] userId 为空，跳过');
    return Promise.resolve(0);
  }
  // 🔥 多账号隔离：切换用户后上一个用户注册的工具必须清空（不同 userId 视为强制重载）
  const userChanged = !!_initializedUserId && _initializedUserId !== userId;
  const effectiveForce = force || userChanged;
  // 同一 userId 已在加载/已加载完成，直接复用（force 时绕过缓存重载）
  if (!effectiveForce && _initializedUserId === userId && _initPromise) {
    return _initPromise;
  }
  if (userChanged) {
    console.log(`[BaseProjectToolLoader] 检测到用户切换: ${_initializedUserId} → ${userId}，清空旧用户工具后重载`);
    _lastRegistryContent = null;
  }
  _initializedUserId = userId;
  if (effectiveForce) {
    console.log('[BaseProjectToolLoader] 强制热重载基础项目工具');
  }

  _initPromise = (async (): Promise<number> => {
    try {
      // 1. 确保基础项目存在
      const { appId, created } = await ensureBaseProjectInternal(userId);
      // 🔥 记录当前用户的基础项目 appId（fs.watch 需监视对应目录，多账号 ID 可能带后缀）
      _baseAppId = appId;

      // 🔥 本次新建的基础项目实时补进项目列表：面板首次拉取早于基础项目创建，
      // 之后 userId 不变不会自动重拉，不广播的话"全部"视图看不到（切一次筛选才出现）
      if (created) {
        try {
          const raw = await desktopAppStorage.getById(appId);
          if (raw) {
            desktopAppEventService.emitAppCreated(appId, userId, mapDbAppToDesktopApp(raw));
            console.log(`[BaseProjectToolLoader] 基础项目已创建并广播列表刷新: ${appId}`);
          }
        } catch (e) {
          console.warn('[BaseProjectToolLoader] 广播基础项目创建事件失败:', e);
        }
      }

      // 2. 逐文件补种（用户已有的文件不动；热重载时同样跳过已有文件）
      await seedBaseProjectFiles(appId);

      // 3. 启动文件系统监视 + 订阅变更广播（幂等；tools/ 任何写入方式都触发热重载）
      subscribeFsWatchReload();
      const electron = (window as any).electron;
      if (electron?.watchBaseTools) {
        electron.watchBaseTools(appId).catch(() => {});
      }

      // 4. 热重载/用户切换时先清空两处注册表（用户可能从 registry.json 删了工具，需注销）
      if (effectiveForce) {
        for (const def of extensionToolRegistry.getAllToolDefinitions()) {
          unregisterTool(def.name);
        }
        extensionToolRegistry.clear();
      }

      // 5. 加载工具（registerTool 是覆盖式注册，同名工具自动更新为新代码）
      const count = await loadToolsFromRegistry(appId);
      console.log(`[BaseProjectToolLoader] 从基础项目 ${appId} 加载了 ${count} 个工具`);
      return count;
    } catch (e) {
      console.error('[BaseProjectToolLoader] 加载失败:', e);
      // 失败重置缓存，允许下次重试
      _initializedUserId = null;
      _initPromise = null;
      return 0;
    }
  })();

  return _initPromise;
}
