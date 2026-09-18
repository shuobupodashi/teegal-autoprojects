import { useState, useRef, useCallback } from 'react';
import { FileAttachment } from '@/components/workspace/types/ChatTypes';
import { createFilePreviews } from '@/utils/files/fileUploadStorage';

export const useChatInput = (currentConversationId?: string | null) => {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<FileAttachment[]>([]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🔥 修改：立即显示文件预览，后台异步上传
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    // 🔥 立即清空 value：否则同一文件第二次选择时 value 不变，浏览器原生行为
    // 不触发 change 事件 → UI 无反应（用户无法在第二轮对话复用同一文件）
    e.target.value = '';

    // 🔥 进度回调：更新files数组中的进度和完整文件对象
    const handleProgress = (fileId: string, progress: number, status: any, uploadedFile?: any) => {
      // 特别检查uploadedFile是否为undefined
      if (uploadedFile === undefined) {
        return;
      }

      setFiles(prev => prev.map(f => {
        if (f.id === fileId) {
          // 🔥 如果有完整的文件对象（包含storageUrl），使用它
          if (uploadedFile) {
            return uploadedFile;
          }
          // 否则只更新进度和状态
          return { ...f, uploadProgress: progress, uploadStatus: status };
        }
        return f;
      }));
    };

    // 🔥 立即创建文件预览并显示（后台异步上传）
    const previews = await createFilePreviews(selectedFiles, handleProgress);
    setFiles(prev => [...prev, ...previews]);
  }, [currentConversationId]);

  const removeFile = useCallback((id: string) => {
    if (id === 'all') {
      setFiles([]);
    } else {
      setFiles(prev => prev.filter(file => file.id !== id));
    }
  }, []);

  const clearInput = useCallback(() => {
    setInput('');
    setFiles([]);
  }, []);

  // 🔥 新增：检查文件是否全部上传完毕
  const checkFilesUploadStatus = useCallback((): { allUploaded: boolean; uploadingCount: number; errorCount: number } => {
    if (files.length === 0) {
      return { allUploaded: true, uploadingCount: 0, errorCount: 0 };
    }

    let uploadingCount = 0;
    let errorCount = 0;

    for (const file of files) {
      if (file.uploadStatus === 'uploading' || file.uploadStatus === 'pending') {
        uploadingCount++;
      } else if (file.uploadStatus === 'error') {
        errorCount++;
      }
    }

    return {
      allUploaded: uploadingCount === 0,
      uploadingCount,
      errorCount
    };
  }, [files]);

  // 🔥 新增：在光标位置插入文件引用
  const insertFileReference = useCallback((file: FileAttachment) => {
    // 格式: @file[file-id] 便于在AutoHandler中提取并查询
    const fileReference = `@file[${file.id}]`;
    
    // 获取当前光标位置
    const textarea = textareaRef.current;
    if (textarea) {
      const startPos = textarea.selectionStart;
      const endPos = textarea.selectionEnd;
      
      // 在光标位置插入文件引用
      const newInput = input.substring(0, startPos) + fileReference + ' ' + input.substring(endPos);
      
      // 更新输入框内容
      setInput(newInput);
      
      // 将光标移动到插入内容之后
      setTimeout(() => {
        textarea.selectionStart = startPos + fileReference.length + 1;
        textarea.selectionEnd = startPos + fileReference.length + 1;
        textarea.focus();
      }, 0);
    } else {
      // 如果无法获取光标位置，直接在末尾添加
      setInput(prev => prev + ' ' + fileReference + ' ');
    }
  }, [input, textareaRef]);

  return {
    input,
    setInput,
    files,
    textareaRef,
    fileInputRef,
    handleFileChange,
    removeFile,
    clearInput,
    checkFilesUploadStatus,
    insertFileReference
  };
};