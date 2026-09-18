/**
 * FileTree 工具函数
 * 
 * 🔥 简化架构：
 * - files/ 目录：当前工作目录（最新版本）
 * - history/ 目录：上一个 commit 版本（每个文件只保留一个版本）
 * 
 * 🔥 跨平台：所有文件操作通过 Electron IPC API（主进程 Node.js fs），
 * 不依赖 PowerShell/Bash 命令，Windows/macOS/Linux 通用。
 * 路径使用 / 分隔符，主进程 path.join 自动适配平台。
 */

import { FileNode, FileHistory, FileVersion, FileOperationResult } from './types';
import { getCodePath } from '@/utils/apptool/AppPathHelper';

/**
 * 格式化文件大小
 */
export function formatSize(size: number): string {
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
  return `${(size / 1024 / 1024).toFixed(1)}MB`;
}

/**
 * 解析 GitHub URL
 */
export function parseRepoUrl(url: string): { owner: string; name: string } | null {
  try {
    const patterns = [
      /github\.com\/([^\/]+)\/([^\/\.]+)/,
      /github\.com:([^\/]+)\/([^\/\.]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return { owner: match[1], name: match[2] };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 获取文件扩展名对应的图标颜色
 */
export function getFileIconColor(ext: string): string {
  const colors: Record<string, string> = {
    py: '#3572A5',      // Python
    js: '#F7DF1E',      // JavaScript
    ts: '#3178C6',      // TypeScript
    json: '#292929',    // JSON
    md: '#083FA1',      // Markdown
    txt: '#B3B3B3',     // Text
    yaml: '#CB171E',    // YAML
    yml: '#CB171E',     // YAML
    dxf: '#E07020',     // DXF (CAD 2D)
    stl: '#20A0E0',     // STL (CAD 3D mesh)
    step: '#20A0E0',    // STEP (CAD 3D solid)
    stp: '#20A0E0',     // STP
    svg: '#FFB13B',     // SVG
    obj: '#20A0E0',     // OBJ (3D mesh)
  };
  return colors[ext] || '#6B7280';
}

/**
 * 判断是否是代码文件
 */
export function isCodeFile(ext: string): boolean {
  const codeExtensions = ['py', 'js', 'ts', 'jsx', 'tsx', 'java', 'cpp', 'c', 'go', 'rs', 'rb', 'php'];
  return codeExtensions.includes(ext.toLowerCase());
}

/**
 * 排序文件节点（目录优先，然后按名称）
 */
export function sortFileNodes(nodes: FileNode[]): FileNode[] {
  return nodes.sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * 🔥 需要过滤的目录名（不区分大小写）
 * 这些目录通常包含大量文件，不应在文件树中显示
 */
const IGNORED_DIRS = new Set([
  'node_modules',
  'history',
  '__pycache__',
  '.venv',
  'venv',
  'env',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.cache',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  'logs',
  'wandb',        // 🔥 W&B 实验跟踪目录，训练时会产生大量文件
  'runs',         // 🔥 TensorBoard 运行目录
  'checkpoints',  // 🔥 模型 checkpoint 目录
  '.ipynb_checkpoints',
]);

/**
 * 过滤不需要显示的文件和目录
 * 🔥 过滤隐藏文件、缓存目录、虚拟环境等
 */
export function filterFileNodes(nodes: FileNode[]): FileNode[] {
  return nodes.filter(node => {
    // 过滤隐藏文件（以 . 开头）
    if (node.name.startsWith('.')) return false;
    // 🔥 过滤缓存目录、虚拟环境等（不区分大小写）
    if (IGNORED_DIRS.has(node.name.toLowerCase())) return false;
    return true;
  });
}

/**
 * 🔥 新建文件
 * 跨平台：通过 Electron IPC API（app-code:save）
 */
export async function createFile(
  appId: string,
  fileName: string,
  content: string = '',
  codePath?: string
): Promise<FileOperationResult> {
  try {
    const electron = (window as any).electron;

    if (!electron?.saveAppCodeFile) {
      return { success: false, error: '非 Electron 环境' };
    }

    const cp = codePath ?? ((await getCodePath(appId)) || undefined);

    // 🔥 检查文件是否已存在
    const existsResult = await electron.checkAppCodeFileExists({ appId, fileName, codePath: cp });
    if (existsResult?.exists) {
      return { success: false, error: '文件已存在' };
    }

    // 🔥 创建文件
    const result = await electron.saveAppCodeFile({ appId, fileName, content, codePath: cp });
    if (!result?.success) {
      return { success: false, error: result?.error || '创建失败' };
    }

    console.log(`[createFile] 已创建文件: ${fileName}`);
    return { success: true };

  } catch (error: any) {
    console.error('[createFile] 创建失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 🔥 删除文件或文件夹
 * 跨平台：通过 Electron IPC API（app-code:delete），主进程用 Node.js fs
 */
export async function deleteFile(
  appId: string,
  fileName: string,
  isDirectory: boolean = false,
  codePath?: string
): Promise<FileOperationResult> {
  try {
    const electron = (window as any).electron;

    if (!electron?.deleteAppCodeFile) {
      return { success: false, error: '非 Electron 环境' };
    }

    const cp = codePath ?? ((await getCodePath(appId)) || undefined);

    // 🔥 使用跨平台 IPC API 删除（同时删除 history 中的版本）
    const result = await electron.deleteAppCodeFile({ appId, fileName, isDirectory, codePath: cp });

    if (!result?.success) {
      return { success: false, error: result?.error || '删除失败' };
    }

    console.log(`[deleteFile] 已删除: ${fileName}`);
    return { success: true };

  } catch (error: any) {
    console.error('[deleteFile] 删除失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 🔥 重命名文件
 * 跨平台：通过 Electron IPC API（app-code:rename），主进程用 Node.js fs
 */
export async function renameFile(
  appId: string,
  oldFileName: string,
  newFileName: string,
  codePath?: string
): Promise<FileOperationResult> {
  try {
    const electron = (window as any).electron;

    if (!electron?.renameAppCodeFile) {
      return { success: false, error: '非 Electron 环境' };
    }

    const cp = codePath ?? ((await getCodePath(appId)) || undefined);

    // 🔥 使用跨平台 IPC API 重命名（同时重命名 history 中的版本）
    const result = await electron.renameAppCodeFile({ appId, oldFileName, newFileName, codePath: cp });

    if (!result?.success) {
      return { success: false, error: result?.error || '重命名失败' };
    }

    console.log(`[renameFile] 已重命名: ${oldFileName} -> ${newFileName}`);
    return { success: true };

  } catch (error: any) {
    console.error('[renameFile] 重命名失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 🔥 保存文件
 * 跨平台：通过 Electron IPC API
 * - save-history：将当前版本备份到 history 目录（如果还没有）
 * - app-code:save：写入新内容
 */
export async function saveFile(
  appId: string,
  fileName: string,
  content: string,
  codePath?: string
): Promise<FileOperationResult> {
  try {
    const electron = (window as any).electron;

    if (!electron?.saveAppCodeFile || !electron?.saveAppCodeHistory) {
      return { success: false, error: '非 Electron 环境' };
    }

    const cp = codePath ?? ((await getCodePath(appId)) || undefined);

    // 🔥 如果 fileName 是完整路径（包含 userDataPath），提取相对路径
    let relativeFileName = fileName;
    // 🔥 统一用 / 作为分隔符比较
    const normalizedFileName = fileName.replace(/\\/g, '/');
    if (normalizedFileName.includes('/apps/')) {
      // 从路径中提取 appId 之后的部分
      const match = normalizedFileName.match(/\/apps\/[^/]+\/(.+)/);
      if (match) {
        relativeFileName = match[1];
      }
    }

    // 🔥 检查当前文件是否存在
    const existsResult = await electron.checkAppCodeFileExists({ appId, fileName: relativeFileName, codePath: cp });

    // 🔥 如果当前文件存在，先备份到 history（如果还没有备份的话）
    if (existsResult?.exists) {
      await electron.saveAppCodeHistory({ appId, fileName: relativeFileName, codePath: cp });
    }

    // 🔥 写入新内容（使用相对路径）
    const result = await electron.saveAppCodeFile({ appId, fileName: relativeFileName, content, codePath: cp });
    if (!result?.success) {
      return { success: false, error: result?.error || '保存失败' };
    }

    console.log(`[saveFile] 已保存文件: ${relativeFileName}`);
    return { success: true };

  } catch (error: any) {
    console.error('[saveFile] 保存失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 🔥 Commit - 清空 history 目录
 * 跨平台：通过 Electron IPC API（app-code:commit）
 */
export async function commitFiles(appId: string, fileName?: string, codePath?: string): Promise<FileOperationResult> {
  try {
    const electron = (window as any).electron;

    if (!electron?.commitAppCodeHistory) {
      return { success: false, error: '非 Electron 环境' };
    }

    const cp = codePath ?? ((await getCodePath(appId)) || undefined);

    // 🔥 如果 fileName 是完整路径（包含 /apps/），提取相对路径（与 saveFile 逻辑一致）
    let relativeFileName = fileName;
    if (fileName) {
      const normalizedFileName = fileName.replace(/\\/g, '/');
      if (normalizedFileName.includes('/apps/')) {
        const match = normalizedFileName.match(/\/apps\/[^/]+\/(.+)/);
        if (match) {
          relativeFileName = match[1];
        }
      }
    }

    // 🔥 使用跨平台 IPC API 清空 history
    const result = await electron.commitAppCodeHistory({ appId, fileName: relativeFileName, codePath: cp });

    if (!result?.success) {
      return { success: false, error: result?.error || '清空失败' };
    }

    // 🔥 触发事件通知 HistoryPanel 刷新
    window.dispatchEvent(new CustomEvent('trainProjectFilesChanged', {
      detail: { appId }
    }));

    return { success: true };

  } catch (error: any) {
    console.error('[commitFiles] 清空失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 🔥 获取文件的历史版本内容
 * 跨平台：通过 Electron IPC API（app-code:read-history）
 */
export async function getHistoryContent(
  appId: string,
  fileName: string,
  codePath?: string
): Promise<string | null> {
  try {
    const electron = (window as any).electron;

    if (!electron?.readAppCodeHistory) {
      return null;
    }

    const cp = codePath ?? ((await getCodePath(appId)) || undefined);

    // 🔥 如果 fileName 是完整路径，提取相对路径
    let relativeFileName = fileName;
    const normalizedFileName = fileName.replace(/\\/g, '/');
    if (normalizedFileName.includes('/apps/')) {
      const match = normalizedFileName.match(/\/apps\/[^/]+\/(.+)/);
      if (match) {
        relativeFileName = match[1];
      }
    }

    // 🔥 使用跨平台 IPC API 读取历史版本
    const result = await electron.readAppCodeHistory({ appId, fileName: relativeFileName, codePath: cp });

    if (result?.success) {
      const content = result.content ?? '';
      console.log('[getHistoryContent] 读取成功，内容长度:', content.length);
      return content;
    }

    console.log('[getHistoryContent] 历史版本不存在:', relativeFileName);
    return null;

  } catch (error) {
    console.error('[getHistoryContent] 获取失败:', error);
    return null;
  }
}

/**
 * 🔥 获取当前文件内容
 * 跨平台：通过 Electron IPC API（app-code:read）
 */
export async function getCurrentFileContent(
  appId: string,
  fileName: string,
  codePath?: string
): Promise<string | null> {
  try {
    const electron = (window as any).electron;

    if (!electron?.readAppCodeFile || !electron?.checkAppCodeFileExists) {
      return null;
    }

    const cp = codePath ?? ((await getCodePath(appId)) || undefined);

    // 🔥 如果 fileName 是完整路径，提取相对路径
    let relativeFileName = fileName;
    const normalizedFileName = fileName.replace(/\\/g, '/');
    if (normalizedFileName.includes('/apps/')) {
      const match = normalizedFileName.match(/\/apps\/[^/]+\/(.+)/);
      if (match) {
        relativeFileName = match[1];
      }
    }

    // 🔥 检查文件是否存在
    const existsResult = await electron.checkAppCodeFileExists({ appId, fileName: relativeFileName, codePath: cp });
    if (!existsResult?.exists) {
      console.log('[getCurrentFileContent] 文件不存在:', relativeFileName);
      return null;
    }

    // 🔥 使用跨平台 IPC API 读取
    const result = await electron.readAppCodeFile({ appId, fileName: relativeFileName, codePath: cp });

    if (result?.success) {
      const content = result.content ?? '';
      console.log('[getCurrentFileContent] 读取成功:', relativeFileName, '内容长度:', content.length);
      return content;
    }

    console.log('[getCurrentFileContent] 读取失败:', relativeFileName, result);
    return null;
  } catch (error) {
    console.error('[getCurrentFileContent] 获取失败:', error);
    return null;
  }
}
