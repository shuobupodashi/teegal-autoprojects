/**
 * 🔥 自动更新通知组件
 * 
 * 简洁的更新流程：
 * Windows: 发现更新 → 自动下载 → 自动安装
 * macOS:  发现更新 → 提示用户下载 DMG → 手动安装（无签名不支持自动安装）
 */

import { useEffect, useState } from 'react';
import { Download, CheckCircle, AlertCircle, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface UpdateInfo {
  version: string;
  downloadUrl?: string;
  requiresManualInstall?: boolean;
}

type UpdateStatus = 'idle' | 'downloading' | 'ready' | 'error' | 'mac-available';

export function UpdateNotification() {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!window.electron?.updater) return;

    // 发现更新
    window.electron.updater.onUpdateAvailable((_, data) => {
      if (data.requiresManualInstall) {
        // 🔥 macOS: 显示"有新版本可用，请手动下载"
        setStatus('mac-available');
        setUpdateInfo({ version: data.version, downloadUrl: data.downloadUrl, requiresManualInstall: true });
        setIsVisible(true);
      } else {
        // Windows: 直接开始下载
        setStatus('downloading');
        setProgress(0);
        setUpdateInfo({ version: data.version });
        setIsVisible(true);
      }
    });

    // 下载进度：更新进度条
    window.electron.updater.onUpdateProgress((_, data) => {
      setProgress(data.progress);
    });

    // 🔥 下载完成：自动安装，不显示toast
    window.electron.updater.onUpdateReady((_, data) => {
      setStatus('ready');
      setUpdateInfo({ version: data.version });
      // 🔥 自动触发安装（延迟500ms让用户看到"已就绪"状态）
      setTimeout(() => {
        handleInstall();
      }, 500);
    });

    // 安装开始：关闭通知窗口（避免白屏问题）
    window.electron.updater.onUpdateInstalling(() => {
      setIsVisible(false);  // 🔥 关闭通知，避免白屏
    });

    // 错误：显示错误信息
    window.electron.updater.onUpdateError((_, data) => {
      setStatus('error');
      setError(data.message);
      setIsVisible(true);
    });
  }, []);

  const handleInstall = async () => {
    try {
      setStatus('ready');
      setIsVisible(false);  // 🔥 先关闭通知窗口
      
      await window.electron?.updater?.install();
    } catch (err) {
      setStatus('error');
      setError('安装更新失败');
      setIsVisible(true);
    }
  };

  // 🔥 macOS: 打开 DMG 下载链接
  const handleMacDownload = () => {
    if (updateInfo?.downloadUrl) {
      window.open(updateInfo.downloadUrl, '_blank');
    }
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  const handleRetry = async () => {
    setIsVisible(false);
    await window.electron?.updater?.check();
    // autoDownload=true，检查成功后会自动触发 onUpdateAvailable 事件
  };

  if (!isVisible || !window.electron?.updater) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {status === 'downloading' && <Download className="w-4 h-4 text-blue-500 animate-bounce" />}
          {status === 'ready' && <CheckCircle className="w-4 h-4 text-green-500" />}
          {status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
          {status === 'mac-available' && <ExternalLink className="w-4 h-4 text-blue-500" />}
          <span className="font-medium text-sm text-slate-900 dark:text-slate-100">
            {status === 'downloading' && `下载更新 ${updateInfo?.version}`}
            {status === 'ready' && `即将安装 ${updateInfo?.version}`}
            {status === 'error' && '更新失败'}
            {status === 'mac-available' && `新版本 ${updateInfo?.version} 可用`}
          </span>
        </div>
        <button onClick={handleDismiss} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 下载进度 */}
      {status === 'downloading' && (
        <div className="mb-2">
          <Progress value={progress} className="h-1.5" />
          <p className="text-xs text-slate-500 mt-1">{progress}%</p>
        </div>
      )}

      {/* 🔥 macOS: 下载 DMG 提示 */}
      {status === 'mac-available' && (
        <p className="text-xs text-slate-500 mb-2">下载 DMG 安装包，手动替换即可完成更新</p>
      )}

      {/* 错误信息 */}
      {status === 'error' && (
        <p className="text-xs text-red-600 mb-2">{error}</p>
      )}

      {/* 操作按钮 */}
      {status === 'error' && (
        <Button onClick={handleRetry} variant="outline" size="sm" className="w-full">
          重试
        </Button>
      )}
      {status === 'mac-available' && (
        <Button onClick={handleMacDownload} variant="default" size="sm" className="w-full gap-1">
          <Download className="w-3.5 h-3.5" />
          下载安装包
        </Button>
      )}
    </div>
  );
}
