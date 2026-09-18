import React, { useRef } from 'react';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileAttachment } from '@/components/workspace/types/ChatTypes';
import { FileUtils } from '@/utils/files';

interface FileUploaderProps {
  files: FileAttachment[];
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (id: string) => void;
  showUploadButton?: boolean;
  // 新增属性用于区分首页和聊天区域
  variant?: 'home' | 'chat';
  // 新增自定义类名支持
  className?: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({ 
  files, 
  onFileChange, 
  onRemoveFile,
  showUploadButton = true,
  variant = 'home', // 默认为首页样式
  className = ''
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  // 使用统一文件处理模块的配置
  const acceptedTypes = [
    'image/*',
    'video/*',
    'audio/*',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/*'
  ].join(',');

  // 🔧 修复：选择同一文件再次触发 change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileChange(e);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 根据variant确定按钮样式
  const getButtonClass = () => {
    // 如果提供了自定义className，则使用它
    if (className) {
      return `h-8 w-8 bg-transparent border-transparent transition-all duration-200 ${className}`;
    }
    
    if (variant === 'chat') {
      // 聊天区域：默认透明背景，无边框，黑色图标
      // 悬停时变为黑色背景，无边框，白色图标
      return "h-8 w-8 bg-transparent border-transparent hover:bg-black hover:border-transparent transition-all duration-200";
    }
    // 首页：默认透明背景，无边框，黑色图标（根据新要求）
    // 悬停时变为黑色背景，无边框，白色图标
    return "h-8 w-8 bg-transparent border-transparent hover:bg-black hover:border-transparent hover:text-white transition-all duration-200";
  };

  // 根据variant和悬停状态确定图标颜色
  const getIconClass = () => {
    // 如果提供了自定义className，则使用指定的颜色
    if (className) {
      // 默认黑色图标，悬停时白色图标
      return "text-black group-hover:text-white";
    }
    
    if (variant === 'chat') {
      // 聊天区域：默认黑色图标，悬停时白色图标
      return "text-black group-hover:text-white";
    }
    // 首页：默认黑色图标，悬停时白色图标
    return "text-black group-hover:text-white";
  };

  return (
    <div>
      {showUploadButton && (
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleClickUpload}
          className={`${getButtonClass()} group`}
          title="上传文件"
          type="button"
        >
          <PlusCircle size={20} className={getIconClass()} />
        </Button>
      )}
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleInputChange}
        multiple
        className="hidden"
        accept={acceptedTypes}
      />
    </div>
  );
};

export default FileUploader;
