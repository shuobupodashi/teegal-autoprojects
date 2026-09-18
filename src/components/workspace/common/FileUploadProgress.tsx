import React from 'react';
import { FileAttachment } from '../types/ChatTypes';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface FileUploadProgressProps {
  file: FileAttachment;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * 文件上传进度指示器
 * 在文件预览卡片上显示上传状态和进度
 */
const FileUploadProgress: React.FC<FileUploadProgressProps> = ({ file, size = 'md' }) => {
  const { uploadStatus, uploadProgress = 0, uploadError } = file;

  // pending 状态：显示等待上传
  if (uploadStatus === 'pending') {
    return (
      <div className="absolute bottom-0 left-0 right-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-1 rounded-b">
        <span className="text-[10px] text-white">等待上传...</span>
      </div>
    );
  }

  // 不显示进度条的情况
  if (!uploadStatus) {
    return null;
  }

  // 成功状态：短暂显示✓后隐藏
  if (uploadStatus === 'success') {
    return (
      <div className="absolute bottom-0 left-0 right-0 bg-green-500 bg-opacity-90 flex items-center justify-center p-1 rounded-b">
        <CheckCircle className="w-3 h-3 text-white" />
        <span className="text-[10px] text-white ml-1">已上传</span>
      </div>
    );
  }

  // 错误状态：显示红色边框和错误提示
  if (uploadStatus === 'error') {
    return (
      <div className="absolute inset-0 border-2 border-red-500 rounded pointer-events-none">
        <div className="absolute bottom-0 left-0 right-0 bg-red-500 bg-opacity-90 flex items-center justify-center p-1 rounded-b">
          <XCircle className="w-3 h-3 text-white" />
          <span className="text-[10px] text-white ml-1 truncate">
            {uploadError || '上传失败'}
          </span>
        </div>
      </div>
    );
  }

  // 上传中状态：显示不确定进度条（无百分比）
  if (uploadStatus === 'uploading') {
    return (
      <div className="absolute bottom-0 left-0 right-0 bg-gray-900 bg-opacity-75 rounded-b overflow-hidden">
        {/* 🔥 不确定进度条：使用shimmer动画 */}
        <div className="h-1 bg-gray-700 relative overflow-hidden">
          <div 
            className="absolute h-full w-full bg-gradient-to-r from-transparent via-green-500 to-transparent"
            style={{
              animation: 'shimmer 1.5s ease-in-out infinite'
            }}
          />
        </div>
        {/* 进度文本：只显示"上传中"，不显示百分比 */}
        <div className="flex items-center justify-center p-1">
          <Loader2 className="w-3 h-3 text-white animate-spin" />
          <span className="text-[10px] text-white ml-1">
            上传中...
          </span>
        </div>
      </div>
    );
  }

  return null;
};

export default FileUploadProgress;
