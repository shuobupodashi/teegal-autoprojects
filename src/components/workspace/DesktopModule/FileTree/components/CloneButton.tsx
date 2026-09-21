/**
 * Clone Repository 按钮
 * 🔥 BootCode 基础项目（base-bootcode*）特殊化：不显示 Clone（防止用户往系统项目里
 * clone 无关仓库污染源码），改为"拉取更新"（git pull --ff-only 同步基准仓库，
 * 本地有修改时 git 如实拒绝，保护用户资产）
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GitBranch, Loader2, X, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useGitClone, executeGitPull } from '../hooks/useGitClone';

/** 🔥 BootCode 项目判断（与后端 DesktopAppDAO.BOOT_PROJECT_ID 规则一致：固定 ID + 多账号后缀） */
function isBootProjectId(appId: string): boolean {
  return appId === 'base-bootcode' || appId.startsWith('base-bootcode-');
}

interface CloneButtonProps {
  appId: string;
  onCloneSuccess: () => void;
  /** 🔥 克隆状态变化通知（true=开始克隆，false=结束）：FileTree 据此启动/停止轮询刷新，让用户看到文件落盘 */
  onCloningChange?: (cloning: boolean) => void;
}

export function CloneButton({ appId, onCloneSuccess, onCloningChange }: CloneButtonProps) {
  const [showInput, setShowInput] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');

  const { cloning, cloneError, cloneProgress, cloneRepo, clearError } = useGitClone();

  // 🔥 BootCode 项目：拉取更新状态
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState('');
  const [pullError, setPullError] = useState('');
  const [pullSuccess, setPullSuccess] = useState(false);

  // 🔥 通知父组件克隆状态（filetree 据此轮询刷新）
  React.useEffect(() => {
    onCloningChange?.(cloning);
  }, [cloning, onCloningChange]);

  const handleClone = async () => {
    const result = await cloneRepo({
      repoUrl,
      appId,
      shallow: true,
    });

    if (result.success) {
      setShowInput(false);
      setRepoUrl('');
      onCloneSuccess();
    }
  };

  const handleCancel = () => {
    setShowInput(false);
    setRepoUrl('');
    clearError();
  };

  // 🔥 BootCode：拉取基准仓库最新版本
  const handlePull = async () => {
    setPulling(true);
    setPullError('');
    setPullSuccess(false);
    onCloningChange?.(true);
    const result = await executeGitPull(
      { appId, repoDir: 'teegal-autoprojects' },
      (msg) => setPullProgress(msg)
    );
    onCloningChange?.(false);
    setPulling(false);
    if (result.success) {
      setPullSuccess(true);
      setTimeout(() => setPullSuccess(false), 3000);
      onCloneSuccess();
    } else {
      setPullError(result.error || '拉取失败');
    }
  };

  // 🔥 BootCode 基础项目：显示"拉取更新"代替 Clone
  if (isBootProjectId(appId)) {
    return (
      <div className="mb-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handlePull}
          disabled={pulling}
        >
          <RefreshCw className={`w-3 h-3 mr-1 ${pulling ? 'animate-spin' : ''}`} />
          拉取更新
        </Button>

        {pulling && (
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            {pullProgress || '正在拉取更新...'}
          </div>
        )}

        {pullSuccess && (
          <div className="flex items-center gap-2 text-xs text-green-600 mt-2">
            <CheckCircle2 className="w-3 h-3" />
            已是最新版本
          </div>
        )}

        {pullError && (
          <div className="flex items-start gap-2 text-xs text-red-500 mt-2">
            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
            <span>{pullError}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mb-2">
      {/* 按钮 */}
      {!showInput && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setShowInput(true)}
          disabled={cloning}
        >
          <GitBranch className="w-3 h-3 mr-1" />
          Clone Repository
        </Button>
      )}

      {/* 输入框 */}
      {showInput && (
        <div className="space-y-2">
          <div className="flex gap-1">
            <Input
              placeholder="https://github.com/user/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="h-8 text-xs"
              disabled={cloning}
              autoFocus
            />
            {!cloning && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={handleCancel}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>

          {/* 进度 */}
          {cloning && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              {cloneProgress}
            </div>
          )}

          {/* 错误 */}
          {cloneError && (
            <div className="flex items-center gap-2 text-xs text-red-500">
              <AlertCircle className="w-3 h-3" />
              {cloneError}
            </div>
          )}

          {/* 克隆按钮 */}
          {!cloning && (
            <Button
              size="sm"
              className="w-full h-8"
              onClick={handleClone}
              disabled={!repoUrl.trim()}
            >
              <GitBranch className="w-3 h-3 mr-1" />
              Clone
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
