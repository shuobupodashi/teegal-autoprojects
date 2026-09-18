/**
 * Git Clone Hook - 前端直接执行（不走后端）
 * 
 * 🔥 跨平台：目录操作通过 Electron IPC API（主进程 Node.js fs），
 * git clone 命令通过 systemCommand 执行（主进程根据平台选 PowerShell/Bash）。
 * 不再硬编码 PowerShell 命令，Windows/macOS/Linux 通用。
 */

import { useState } from 'react';
import { CloneOptions, CloneResult } from '../types';
import { parseRepoUrl } from '../utils';
import { getAppBasePath, getCodePath } from '@/utils/apptool/AppPathHelper';

export function useGitClone() {
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string>('');
  const [cloneProgress, setCloneProgress] = useState<string>('');

  /**
   * 克隆 GitHub 仓库
   */
  const cloneRepo = async (options: CloneOptions): Promise<CloneResult> => {
    const { repoUrl, appId, shallow = true, targetPath } = options;

    if (!repoUrl.trim()) {
      return { success: false, error: '请输入 GitHub URL' };
    }

    // 🔥 清理 URL（移除多余的反引号、空格等）
    const cleanUrl = repoUrl.trim().replace(/[`'"]/g, '').trim();

    const repoInfo = parseRepoUrl(cleanUrl);
    if (!repoInfo) {
      return { success: false, error: '无效的 GitHub URL' };
    }

    setCloning(true);
    setCloneError('');
    setCloneProgress('正在准备克隆...');

    try {
      const electron = (window as any).electron;
      
      // 🔥 获取用户数据目录
      let userDataPath = '';
      if (electron?.getUserDataPath) {
        userDataPath = await electron.getUserDataPath();
        // 修正开发模式路径
        if (userDataPath.endsWith('\\dev') || userDataPath.endsWith('/dev')) {
          userDataPath = userDataPath.slice(0, -4);
        }
      } else {
        // 开发环境备选
        userDataPath = process.cwd();
      }

      // 🔥 目标目录：支持导入项目的自定义路径
      const repoName = targetPath || repoInfo.name;
      const baseDir = await getAppBasePath(appId);
      const targetDir = `${baseDir}/${repoName}`;

      // 🔥 确保 app 目录存在（跨平台 IPC API）
      const codePath = await getCodePath(appId);
      setCloneProgress('创建目录...');
      await ensureDirectory(appId, codePath || undefined);

      // 🔥 如果目标目录已存在，先删除（跨平台 IPC API）
      if (await checkDirectoryExists(appId, repoName, codePath || undefined)) {
        setCloneProgress('删除旧目录...');
        await deleteDirectory(appId, repoName, codePath || undefined);
      }

      // 🔥 执行 git clone（通过 systemCommand，主进程自动选择 Shell）
      setCloneProgress('正在克隆...');
      const cloneCommand = shallow 
        ? `git clone --depth 1 "${cleanUrl}" "${targetDir}"`
        : `git clone "${cleanUrl}" "${targetDir}"`;

      const result = await executeCommand(cloneCommand);

      if (!result.success) {
        throw new Error(result.error || '克隆失败');
      }

      setCloneProgress('克隆完成！');
      console.log(`[GitClone] 克隆成功: ${repoName}`);

      return {
        success: true,
        repoName,
      };

    } catch (error: any) {
      console.error('[GitClone] 克隆失败:', error);
      
      let errorMessage = error.message;
      const msg = error.message;
      if (/is not recognized|command not found|不是内部或外部命令|无法找到/i.test(msg)) {
        errorMessage = '未检测到 Git，请先安装 Git（https://git-scm.com）';
      } else if (/Repository not found|not found/i.test(msg) && !/unable to access/i.test(msg)) {
        errorMessage = '仓库不存在或无权限访问';
      } else if (/unable to access|Connection was reset|Could not resolve host|Failed to connect|timed out|timeout|SSL|proxy/i.test(msg)) {
        errorMessage = '网络连接失败，请检查网络或代理设置（国内网络访问 GitHub 可能需要代理）';
      }

      setCloneError(errorMessage);
      return { success: false, error: errorMessage };

    } finally {
      setCloning(false);
      setCloneProgress('');
    }
  };

  return {
    cloning,
    cloneError,
    cloneProgress,
    cloneRepo,
    clearError: () => setCloneError(''),
  };
}

// ============ 辅助函数 ============

/**
 * 执行命令（使用 Electron systemCommand）
 * 🔥 主进程根据平台自动选择 PowerShell/Bash
 */
async function executeCommand(command: string): Promise<{ success: boolean; output?: string; error?: string }> {
  try {
    const electron = (window as any).electron;
    
    // 🔥 优先使用 Electron 的 systemCommand
    if (electron?.systemCommand) {
      const result = await electron.systemCommand({ command, timeout: 300 });
      return {
        success: result.success,
        output: result.output,
        error: result.error,
      };
    }

    // 🔥 备选：使用 handleExecuteCommand
    const { handleExecuteCommand } = await import('@/utils/systemtools/executeCommand');
    const result = await handleExecuteCommand({
      command,
      timeout: 300, // 5 分钟超时
    });

    return {
      success: result.success,
      output: result.output,
      error: result.error,
    };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * 确保 App 代码目录存在
 * 🔥 跨平台：通过 Electron IPC API（app-code:ensure-dir）
 */
async function ensureDirectory(appId: string, codePath?: string): Promise<void> {
  const electron = (window as any).electron;
  if (electron?.ensureAppCodeDir) {
    await electron.ensureAppCodeDir({ appId, dirPath: '.', codePath });
  }
}

/**
 * 检查目录是否存在
 * 🔥 跨平台：通过 Electron IPC API（app-code:dir-exists）
 */
async function checkDirectoryExists(appId: string, dirPath: string, codePath?: string): Promise<boolean> {
  const electron = (window as any).electron;
  if (electron?.checkAppCodeDirExists) {
    const result = await electron.checkAppCodeDirExists({ appId, dirPath, codePath });
    return result?.exists || false;
  }
  return false;
}

/**
 * 删除目录
 * 🔥 跨平台：通过 Electron IPC API（app-code:delete）
 */
async function deleteDirectory(appId: string, dirPath: string, codePath?: string): Promise<void> {
  const electron = (window as any).electron;
  if (electron?.deleteAppCodeFile) {
    await electron.deleteAppCodeFile({ appId, fileName: dirPath, isDirectory: true, codePath });
  }
}
