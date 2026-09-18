/**
 * Clone Repository 按钮
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GitBranch, Loader2, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { useGitClone } from '../hooks/useGitClone';

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