/**
 * 版本历史管理 Hook
 * 
 * 🔥 跨平台：所有文件操作通过 Electron IPC API（主进程 Node.js fs），
 * 不依赖 PowerShell/Bash 命令，Windows/macOS/Linux 通用。
 */

import { useState } from 'react';
import { getCodePath } from '@/utils/apptool/AppPathHelper';

interface VersionInfo {
  versionName: string;
}

export function useVersionHistory(appId: string, history: VersionInfo[]) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>('');

  /**
   * 保存当前版本
   * 🔥 跨平台：通过 Electron IPC API（app-code:copy-dir）
   */
  const saveVersion = async (options?: { versionName?: string }): Promise<{ success: boolean; versionName?: string; error?: string }> => {
    setSaving(true);
    setSaveError('');

    try {
      const electron = (window as any).electron;

      if (!electron?.ensureAppCodeDir || !electron?.copyAppCodeDir) {
        throw new Error('非 Electron 环境');
      }

      // 🔥 生成版本名（v1, v2, v3...）
      const existingVersions = history.map(v => v.versionName);
      let versionNum = 1;
      while (existingVersions.includes(`v${versionNum}`)) versionNum++;
      const versionName = options?.versionName || `v${versionNum}`;

      // 🔥 获取 codePath（导入项目时需要传给 IPC）
      const codePath = await getCodePath(appId);

      // 🔥 确保 history 目录存在
      await electron.ensureAppCodeDir({ appId, dirPath: 'history' });

      // 🔥 复制整个 appId 目录到 history/{versionName}
      const result = await electron.copyAppCodeDir({
        appId,
        sourceDir: '.',      // 当前整个 appId 目录
        targetDir: `history/${versionName}`,
        codePath: codePath || undefined,
      });

      if (!result?.success) {
        throw new Error(result?.error || '复制失败');
      }

      console.log(`[VersionHistory] 保存版本成功: ${versionName}`);

      return {
        success: true,
        versionName,
      };

    } catch (error: any) {
      console.error('[VersionHistory] 保存版本失败:', error);
      
      let errorMessage = error.message;
      if (error.message.includes('not found')) {
        errorMessage = '目录不存在';
      }

      setSaveError(errorMessage);
      return { success: false, error: errorMessage };

    } finally {
      setSaving(false);
    }
  };

  /**
   * 删除版本
   * 🔥 跨平台：通过 Electron IPC API（app-code:delete）
   */
  const deleteVersion = async (versionName: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const electron = (window as any).electron;

      if (!electron?.deleteAppCodeFile) {
        throw new Error('非 Electron 环境');
      }

      // 🔥 使用跨平台 IPC API 删除版本目录
      const result = await electron.deleteAppCodeFile({
        appId,
        fileName: `history/${versionName}`,
        isDirectory: true,
      });

      if (!result?.success) {
        throw new Error(result?.error || '删除失败');
      }

      console.log(`[VersionHistory] 删除版本成功: ${versionName}`);
      return { success: true };

    } catch (error: any) {
      console.error('[VersionHistory] 删除版本失败:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * 恢复版本（将 history/{versionName} 的内容复制回当前目录）
   * 🔥 跨平台：通过 Electron IPC API
   */
  const restoreVersion = async (versionName: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const electron = (window as any).electron;

      if (!electron?.deleteAppCodeFile || !electron?.copyAppCodeDir) {
        throw new Error('非 Electron 环境');
      }

      // 🔥 先删除当前目录中的非 history 文件
      // 通过 readDirectory 获取当前目录文件列表，逐个删除
      if (electron?.readDirectory) {
        const currentDir = await electron.getUserDataPath();
        let userDataPath = currentDir;
        if (userDataPath.endsWith('\\dev') || userDataPath.endsWith('/dev')) {
          userDataPath = userDataPath.slice(0, -4);
        }

        const appDirResult = await electron.readDirectory(`${userDataPath}/apps/${appId}`);
        if (appDirResult?.success && appDirResult?.files) {
          for (const item of appDirResult.files) {
            // 🔥 保留 history 目录
            if (item.name !== 'history') {
              await electron.deleteAppCodeFile({
                appId,
                fileName: item.name,
                isDirectory: item.type === 'directory',
              });
            }
          }
        }
      }

      // 🔥 复制版本内容回当前目录
      const result = await electron.copyAppCodeDir({
        appId,
        sourceDir: `history/${versionName}`,
        targetDir: '.',
      });

      if (!result?.success) {
        throw new Error(result?.error || '恢复失败');
      }

      console.log(`[VersionHistory] 恢复版本成功: ${versionName}`);
      return { success: true };

    } catch (error: any) {
      console.error('[VersionHistory] 恢复版本失败:', error);
      return { success: false, error: error.message };
    }
  };

  return {
    saving,
    saveError,
    saveVersion,
    deleteVersion,
    restoreVersion,
    clearError: () => setSaveError(''),
  };
}
