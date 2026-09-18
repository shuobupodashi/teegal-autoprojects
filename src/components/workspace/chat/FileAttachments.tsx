
import React from 'react';
import { X, File, Image, Video, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileAttachment } from '../types/ChatTypes';

interface FileAttachmentsProps {
  files: FileAttachment[];
  onRemoveFile: (id: string) => void;
  showRemoveButtons?: boolean;
}

const FileAttachments: React.FC<FileAttachmentsProps> = ({ 
  files, 
  onRemoveFile, 
  showRemoveButtons = true 
}) => {
  // 🔍 添加调试日志
  console.log('🎯 FileAttachments 组件渲染:', {
    filesCount: files.length,
    showRemoveButtons,
    fileDetails: files.map(f => ({
      id: f.id,
      name: f.name,
      type: f.type,
      hasContent: !!f.content,
      contentLength: f.content?.length || 0,
      contentType: f.content?.startsWith('data:') ? 'base64' : f.content?.startsWith('http') ? 'url' : 'other'
    }))
  });

  if (files.length === 0) {
    console.log('📎 FileAttachments: 没有文件可显示');
    return null;
  }

  const getFileIcon = (attachment: FileAttachment) => {
    // 🔧 改进文件类型检测逻辑
    const content = attachment.content || '';
    const type = attachment.type || '';
    
    // 从content字段判断文件类型
    if (content.startsWith('data:image/') || type.startsWith('image')) return <Image className="w-4 h-4" />;
    if (content.startsWith('data:video/') || type.startsWith('video')) return <Video className="w-4 h-4" />;
    if (content.includes('pdf') || type.includes('pdf') || type.includes('document')) return <FileText className="w-4 h-4" />;
    
    return <File className="w-4 h-4" />;
  };

  const handleFileClick = (file: FileAttachment) => {
    // 🔧 改进文件点击处理逻辑，确保正确的文件预览
    console.log('🖱️ 点击文件:', {
      id: file.id,
      name: file.name,
      hasContent: !!file.content
    });
    
    const content = file.content || file.base64 || file.preview || '';
    
    if (content && content.startsWith('data:')) {
      // 对于base64数据，创建blob URL并打开
      try {
        // 解析data URL
        const [header, data] = content.split(',');
        const mimeMatch = header.match(/data:([^;]+)/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        
        const byteCharacters = atob(data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        // 清理URL对象
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) {
        console.error('❌ 打开文件失败:', error);
      }
    } else if (content && (content.startsWith('http://') || content.startsWith('https://'))) {
      // 对于URL，直接打开
      window.open(content, '_blank');
    }
  };

  return (
    <div className="mb-2">
      <div className="flex flex-wrap gap-2">
        {files.map(file => (
          <div 
            key={file.id} 
            className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-md text-sm cursor-pointer hover:bg-gray-200 transition-colors"
            onClick={() => handleFileClick(file)}
          >
            {getFileIcon(file)}
            <span className="text-gray-700 truncate max-w-32">{file.name}</span>
            {showRemoveButtons && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation(); // 阻止冒泡到文件点击事件
                  onRemoveFile(file.id);
                }}
                className="h-4 w-4 p-0 hover:bg-red-100"
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileAttachments;
