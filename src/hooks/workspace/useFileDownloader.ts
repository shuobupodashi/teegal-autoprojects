
import { useState } from 'react';
import { FileAttachment } from '@/components/workspace/types/ChatTypes';
import { toast } from 'sonner';

export const useFileDownloader = () => {
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadAndStoreFile = async (
    file: FileAttachment, 
    persistContext?: { 
      targetType: 'message' | 'snapshot'; 
      targetId: string;
      fileIndex?: number; // 添加文件索引，用于精确更新
    }
  ): Promise<FileAttachment> => {
    console.log('🔄 [文件下载器] 开始处理文件:', file.name);
    
    // 🔥 检查1：如果文件已经有 storageUrl，直接返回
    if ((file as any).storageUrl) {
      console.log('✅ [文件下载器] 文件已有 storageUrl，无需重复处理:', (file as any).storageUrl);
      return file;
    }
    
    // 🔥 检查2：如果文件已经有base64数据或者不是URL，直接返回
    if (file.content && (file.content.startsWith('data:') || !file.content.startsWith('http'))) {
      console.log('📁 [文件下载器] 文件已有本地数据，跳过下载');
      return file;
    }

    setIsDownloading(true);
    
    try {
      // 🔥 使用 resultFileStorage 统一处理：下载 + 上传
      const { resultFileStorage } = await import('@/utils/files/resultFileStorage');
      const { adaptLegacyFileAttachment } = await import('@/utils/files/compatibility');
      
      const unifiedFile = adaptLegacyFileAttachment(file);
      const result = await resultFileStorage(
        unifiedFile,
        persistContext?.targetType === 'snapshot' ? persistContext.targetId : undefined
      );
      
      if (!result.success || !result.file) {
        throw new Error(result.error || '文件处理失败');
      }

      console.log('✅ [文件下载器] 文件处理成功:', {
        fileName: file.name,
        hasStorageUrl: !!result.file.storageUrl,
        hasContent: !!result.file.content
      });

      // 返回增强的文件对象
      const enhancedFile: FileAttachment = {
        ...file,
        content: result.file.storageUrl || result.file.url, // 优先使用 storageUrl
        url: result.file.storageUrl || result.file.url,
        base64: result.file.content, // base64 内容
        preview: result.file.content,
        originalBase64: result.file.content,
        thumbnailBase64: result.file.content,
        storageUrl: result.file.storageUrl,
        isUploaded: true,
        uploadTimestamp: result.file.uploadTimestamp || Date.now()
      };

      return enhancedFile;

    } catch (error) {
      console.error('❌ [文件下载器] 文件处理失败:', error);
      toast.error(`文件处理失败: ${file.name}`);
      return file; // 返回原文件
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadMultipleFiles = async (files: FileAttachment[]): Promise<FileAttachment[]> => {
    console.log('📦 批量下载文件:', files.length);
    
    const results: FileAttachment[] = [];
    
    for (const file of files) {
      try {
        const enhancedFile = await downloadAndStoreFile(file);
        results.push(enhancedFile);
      } catch (error) {
        console.error(`❌ 下载文件失败: ${file.name}`, error);
        results.push(file); // 保留原文件
      }
    }
    
    console.log('✅ 批量下载完成:', {
      total: files.length,
      successful: results.filter(f => f.content && f.content.startsWith('data:')).length
    });
    
    return results;
  };

  return {
    downloadAndStoreFile,
    downloadMultipleFiles,
    isDownloading
  };
};
