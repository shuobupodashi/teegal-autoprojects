/**
 * 🔥 本地文件存储服务
 * 用于 Electron 本地存储模式下管理文件
 * 文件存储在应用数据目录下的 files/{conversationId}/ 文件夹中
 */

import { FileAttachment } from '@/components/workspace/types/ChatTypes';

/**
 * 本地文件存储配置
 */
const CONFIG = {
  // 文件存储根目录（相对于应用数据目录）
  rootDir: 'files',
  // 最大文件大小（100MB）
  maxFileSize: 100 * 1024 * 1024,
  // 支持的文件类型
  allowedTypes: ['*/*'], // 允许所有类型，具体限制由业务层控制
};

/**
 * 检查是否在 Electron 环境
 */
function isElectron(): boolean {
  return typeof window !== 'undefined' && 
         typeof (window as any).electron !== 'undefined';
}

/**
 * 🔥 创建轻量化文件对象（用于数据库存储）
 * 当文件保存到本地后，清理 base64 大字段，保留 localPath 和云端 URL 作为回退
 * 
 * 渲染优先级：localPath > content > storageUrl > url
 * 
 * @param originalFile - 原始文件对象
 * @param localPath - 本地文件路径
 * @returns 清理后的文件对象
 */
export function createLightweightFileAttachment(
  originalFile: FileAttachment,
  localPath: string
): FileAttachment {
  return {
    // 保留核心标识信息
    id: originalFile.id,
    name: originalFile.name,
    type: originalFile.type,
    mimeType: originalFile.mimeType,
    size: originalFile.size,
    
    // 🔥 本地存储路径（优先渲染）
    localPath: localPath,
    
    // 🔥 清理 base64 大字段（由 localPath 替代）
    content: '', // 清空 base64 内容
    base64: undefined,
    preview: undefined,
    thumbnailBase64: undefined,
    originalBase64: undefined,
    
    // ✅ 保留云端 URL 作为回退（本地文件缺失时使用）
    storageUrl: originalFile.storageUrl,
    url: originalFile.url,
    pptUrl: originalFile.pptUrl,
    
    // 保留其他元数据
    isUploaded: true, // 标记为已上传（到本地）
    uploadTimestamp: originalFile.uploadTimestamp || Date.now(),
    source: originalFile.source,
    dimensions: originalFile.dimensions,
    fileAnalysisResult: originalFile.fileAnalysisResult,
    analysisTimestamp: originalFile.analysisTimestamp,
    metadata: originalFile.metadata,
    
    // 上传状态
    uploadStatus: 'success',
    uploadProgress: 100,
  };
}

/**
 * 🔥 保存文件到本地存储
 * 
 * @param conversationId - 对话ID，用于创建子文件夹
 * @param file - 文件对象（包含 content base64 数据）
 * @returns 本地文件路径
 */
export async function saveFileToLocal(
  conversationId: string,
  file: FileAttachment
): Promise<string> {
  if (!isElectron()) {
    throw new Error('本地文件存储仅在 Electron 环境中可用');
  }

  if (!file.content) {
    throw new Error('文件内容不能为空');
  }

  const electron = (window as any).electron;
  
  // 构建文件路径：files/{conversationId}/{fileId}_{fileName}
  const safeFileName = file.name.replace(/[<>:"/\\|?*]/g, '_');
  const fileName = `${file.id}_${safeFileName}`;
  
  try {
    const result = await electron.saveLocalFile({
      conversationId,
      fileName,
      content: file.content,
      mimeType: file.mimeType || file.type
    });

    if (!result.success) {
      throw new Error(result.error || '保存文件失败');
    }

    console.log('✅ [LOCAL-FILE] 文件已保存到本地:', {
      fileName: file.name,
      localPath: result.localPath,
      size: file.size
    });

    return result.localPath;
  } catch (error) {
    console.error('❌ [LOCAL-FILE] 保存文件失败:', error);
    throw error;
  }
}

/**
 * 🔥 从本地存储读取文件内容
 * 
 * @param localPath - 本地文件路径
 * @returns 文件内容（base64）
 */
export async function readFileFromLocal(localPath: string): Promise<string> {
  if (!isElectron()) {
    throw new Error('本地文件存储仅在 Electron 环境中可用');
  }

  const electron = (window as any).electron;
  
  try {
    const result = await electron.readLocalFile({ localPath });

    if (!result.success) {
      throw new Error(result.error || '读取文件失败');
    }

    return result.content;
  } catch (error) {
    console.error('❌ [LOCAL-FILE] 读取文件失败:', error);
    throw error;
  }
}

