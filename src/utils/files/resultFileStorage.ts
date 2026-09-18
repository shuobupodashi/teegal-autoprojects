
import { UnifiedFileAttachment } from './types';
import { FileAttachment } from '@/components/workspace/types/ChatTypes';
import { StorageFactory } from '@/utils/storage/StorageFactory';
import { storageMode } from '@/services/storage/StorageMode';
import {
  saveFileToLocal,
  createLightweightFileAttachment,
  readFileFromLocal
} from './localFileStorage';
import { urlToBase64 } from './urlToBase64';
import { DownloadService } from '@/services/DownloadService';
import { sanitizeFileName } from './fileUploadStorage';

/**
 * 文件操作结果类型
 */
export interface FileOperationResult {
  success: boolean;
  message?: string;
  error?: string;
  file?: UnifiedFileAttachment;
}

/**
 * 🔥 resultFileStorage - 检查并上传文件到 Storage
 * 
 * 核心逻辑：
 * 1. 本地模式：保存到本地文件系统
 * 2. 在线模式：上传到 OSS Storage
 * 3. 如果是外部 URL，先下载再处理
 * 4. 更新 file 对象的 storageUrl/localPath 字段
 * 
 * @param file - 文件对象
 * @param conversationId - 对话ID（本地存储模式需要，用于创建文件夹）
 * @param snapshotId - 快照ID（可选，用于持久化更新）
 * @returns 操作结果，包含更新后的文件对象
 */
export async function resultFileStorage(
  file: UnifiedFileAttachment | FileAttachment,
  conversationId?: string,
  snapshotId?: string
): Promise<FileOperationResult> {
  try {
    console.log('🔍 [RESULT-FILE-STORAGE] 开始检查文件存储状态:', {
      fileName: file.name,
      fileId: file.id,
      hasStorageUrl: !!file.storageUrl,
      hasLocalPath: !!(file as any).localPath,
      storageMode: storageMode.getMode(),
      snapshotId,
      source: (file as any).source,
      hasSource: !!(file as any).source
    });

    // 🔥 步骤1：检查存储模式
    if (storageMode.isLocal()) {
      // ========== 本地存储模式 ==========
      return await handleLocalFileStorage(file, conversationId, snapshotId);
    } else {
      // ========== 在线存储模式 ==========
      return await handleCloudFileStorage(file, snapshotId);
    }
  } catch (error) {
    console.error('❌ [RESULT-FILE-STORAGE] 处理异常:', error);
    return { success: false, error: '文件存储处理异常' };
  }
}

/**
 * 🔥 处理本地文件存储
 */
async function handleLocalFileStorage(
  file: UnifiedFileAttachment | FileAttachment,
  conversationId?: string,
  snapshotId?: string
): Promise<FileOperationResult> {
  // 检查是否已有 localPath
  if ((file as any).localPath) {
    console.log('✅ [RESULT-FILE-STORAGE] 文件已有 localPath，跳过保存:', {
      fileName: file.name,
      localPath: (file as any).localPath
    });
    return { success: true, file: file as UnifiedFileAttachment };
  }

  // 🔥 如果没有提供 conversationId，尝试从 file.metadata 中获取
  if (!conversationId && (file as any).metadata?.conversationId) {
    conversationId = (file as any).metadata.conversationId;
  }

  // 🔥 如果仍然没有 conversationId，使用默认文件夹
  const folderId = conversationId || 'default';

  try {
    // 获取文件内容（base64）
    const base64Content = await getFileBase64Content(file);
    
    if (!base64Content) {
      console.warn('⚠️ [RESULT-FILE-STORAGE] 无法获取文件内容:', file.name);
      return { success: false, error: '无法获取文件内容' };
    }

    // 保存到本地
    const fileWithContent = { ...file, content: base64Content };
    const localPath = await saveFileToLocal(folderId, fileWithContent as FileAttachment);

    // 🔥 只管理 localPath 字段，返回包含 localPath 的文件对象
    const resultFile = {
      ...file,
      localPath: localPath,
      content: undefined, // 保存成功后清空 content，避免存储过大
      isUploaded: true,
      uploadTimestamp: Date.now()
    };

    console.log('✅ [RESULT-FILE-STORAGE] 文件已保存到本地:', {
      fileName: file.name,
      localPath,
      conversationId
    });

    return { success: true, file: resultFile as UnifiedFileAttachment };

  } catch (error) {
    console.error('❌ [RESULT-FILE-STORAGE] 本地存储失败:', error);
    return { success: false, error: error instanceof Error ? error.message : '本地存储失败' };
  }
}

/**
 * 🔥 处理云端文件存储（原有逻辑）
 */
async function handleCloudFileStorage(
  file: UnifiedFileAttachment | FileAttachment,
  snapshotId?: string
): Promise<FileOperationResult> {
  // 🔥 步骤1：检查是否已有 storageUrl
  if (file.storageUrl) {
    console.log('✅ [RESULT-FILE-STORAGE] 文件已有 storageUrl，跳过上传:', {
      fileName: file.name,
      storageUrl: file.storageUrl.substring(0, 80)
    });
    return { success: true, file: file as UnifiedFileAttachment };
  }

    // 🔥 步骤2：从 content 或 url 获取文件源
    const contentOrUrl = file.content || (file as any).url || '';
    
    if (!contentOrUrl) {
      console.warn('⚠️ [RESULT-FILE-STORAGE] 文件没有 content 或 url，无法处理');
      return { success: false, error: '文件没有 content 或 url' };
    }

    let processedFile: UnifiedFileAttachment;

    // 🔥 步骤3：判断是 base64 还是外部 URL
    const isExternalUrl = contentOrUrl.startsWith('http://') || contentOrUrl.startsWith('https://');
    const isBase64DataUrl = contentOrUrl.startsWith('data:');
    // 🔥 检测是否为纯文本内容（如 Markdown）
    const isTextContent = file.mimeType?.startsWith('text/') || file.type?.startsWith('text/');
    
    // 🔥 如果是纯文本且不是 URL，需要转为 base64
    const needsBase64Conversion = isTextContent && !isExternalUrl && !isBase64DataUrl;
    
    if (needsBase64Conversion) {
      // 🔥 情况1：纯文本内容（Markdown/TXT等），转为 base64 再上传
      console.log('📝 [RESULT-FILE-STORAGE] 检测到纯文本内容，转为 base64 再上传...');
      
      try {
        // 将纯文本转为 base64
        const textBase64 = btoa(unescape(encodeURIComponent(contentOrUrl)));
        const base64DataUrl = `data:${file.mimeType || file.type || 'text/plain'};base64,${textBase64}`;
        
        const storageProvider = StorageFactory.getDefaultProvider();
        const uploadPath = `${Date.now()}-${Math.random().toString(36).substring(2)}-${sanitizeFileName(file.name)}`;
        
        const uploadResult = await storageProvider.upload(
          'downloaded-files',
          uploadPath,
          base64DataUrl, // 使用 base64 data URL
          {
            contentType: file.mimeType || file.type || 'text/plain',
            upsert: false,
          }
        );

        if (uploadResult.success && uploadResult.url) {
          console.log('✅ [RESULT-FILE-STORAGE] 纯文本上传成功，storageUrl:', uploadResult.url);
          
          processedFile = {
            ...(file as UnifiedFileAttachment),
            content: base64DataUrl, // 保存 base64 内容以便前端查看
            storageUrl: uploadResult.url,
            url: uploadResult.url,
            isStored: true,
            isUploaded: true,
            uploadTimestamp: Date.now(),
            source: (file as any).source, // 🔥 保留 source 字段
            metadata: {
              ...(file as UnifiedFileAttachment).metadata,
              storagePath: uploadPath,
              processedAt: new Date().toISOString(),
              originalContentType: 'text'
            }
          };
        } else {
          console.error('❌ [RESULT-FILE-STORAGE] 上传失败:', uploadResult.error);
          return { success: false, error: uploadResult.error || '上传失败' };
        }
      } catch (error) {
        console.error('❌ [RESULT-FILE-STORAGE] 纯文本上传异常:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    } else if (isBase64DataUrl || (!isExternalUrl && contentOrUrl.length > 100)) {
      // 🔥 情况2：已经是 base64，直接上传到 Storage
      console.log('📤 [RESULT-FILE-STORAGE] 检测到 base64 内容，直接上传到 Storage...');
      
      try {
        // 🔥 使用静态导入的 StorageFactory
        const storageProvider = StorageFactory.getDefaultProvider();

        const uploadPath = `${Date.now()}-${Math.random().toString(36).substring(2)}-${sanitizeFileName(file.name)}`;
        
        const uploadResult = await storageProvider.upload(
          'downloaded-files', // 🔥 使用 downloaded-files bucket
          uploadPath,
          contentOrUrl,
          {
            contentType: file.mimeType || file.type || 'application/octet-stream',
            upsert: false,
          }
        );

        if (uploadResult.success && uploadResult.url) {
          console.log('✅ [RESULT-FILE-STORAGE] 上传成功，storageUrl:', uploadResult.url);
          
          processedFile = {
            ...(file as UnifiedFileAttachment),
            storageUrl: uploadResult.url,
            url: uploadResult.url,
            isStored: true,
            isUploaded: true,
            uploadTimestamp: Date.now(),
            source: (file as any).source, // 🔥 保留 source 字段
            metadata: {
              ...(file as UnifiedFileAttachment).metadata,
              storagePath: uploadPath,
              processedAt: new Date().toISOString()
            }
          };
        } else {
          console.error('❌ [RESULT-FILE-STORAGE] 上传失败:', uploadResult.error);
          return { success: false, error: uploadResult.error || '上传失败' };
        }
      } catch (error) {
        console.error('❌ [RESULT-FILE-STORAGE] 上传异常:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    } else if (isExternalUrl) {
      // 🔥 情况3：外部 URL，先下载获取 base64 内容，再上传到 Storage
      console.log('📥 [RESULT-FILE-STORAGE] 检测到外部 URL，调用代理下载...');

      try {
        // 🔥 步骤1：调用 DownloadService 只下载，不上传
        const downloadResult = await DownloadService.downloadFile({
          url: contentOrUrl,
          fileName: file.name,
          fileType: file.mimeType || file.type || 'application/octet-stream'
        });

        if (!downloadResult.success) {
          console.error('❌ [RESULT-FILE-STORAGE] 下载失败:', downloadResult.error);
          return { success: false, error: downloadResult.error || '下载失败' };
        }

        console.log('✅ [RESULT-FILE-STORAGE] 代理下载成功，获得 base64 内容');
        
        // 🔥 步骤2：使用下载的 base64 内容上传到 Storage
        const storageProvider = StorageFactory.getDefaultProvider();
        const uploadPath = `${Date.now()}-${Math.random().toString(36).substring(2)}-${sanitizeFileName(file.name)}`;
        
        const uploadResult = await storageProvider.upload(
          'downloaded-files', // 🔥 使用 downloaded-files bucket
          uploadPath,
          downloadResult.base64!, // 使用下载的 base64
          {
            contentType: file.mimeType || file.type || 'application/octet-stream',
            upsert: false,
          }
        );

        if (uploadResult.success && uploadResult.url) {
          console.log('✅ [RESULT-FILE-STORAGE] 上传成功，storageUrl:', uploadResult.url);

          processedFile = {
            ...(file as UnifiedFileAttachment),
            content: downloadResult.base64!, // 保存下载的 base64 内容
            storageUrl: uploadResult.url,
            url: uploadResult.url,
            isStored: true,
            isUploaded: true,
            uploadTimestamp: Date.now(),
            source: (file as any).source, // 🔥 保留 source 字段
            metadata: {
              ...(file as UnifiedFileAttachment).metadata,
              storagePath: uploadPath,
              originalUrl: contentOrUrl,
              processedAt: new Date().toISOString()
            }
          };
        } else {
          console.error('❌ [RESULT-FILE-STORAGE] 上传失败:', uploadResult.error);
          return { success: false, error: uploadResult.error || '上传失败' };
        }
      } catch (error) {
        console.error('❌ [RESULT-FILE-STORAGE] 处理外部 URL 异常:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    } else {
      console.warn('⚠️ [RESULT-FILE-STORAGE] 无法识别的内容类型');
      return { success: false, error: '无法识别的内容类型' };
    }

    console.log('✅ [RESULT-FILE-STORAGE] 文件存储成功:', {
      fileName: file.name,
      storageUrl: processedFile.storageUrl?.substring(0, 100)
    });

    return { success: true, file: processedFile };
}

/**
 * 🔥 获取文件的 base64 内容
 * 优先本地下载，如果失败了再尝试云端下载
 */
async function getFileBase64Content(file: UnifiedFileAttachment | FileAttachment): Promise<string | null> {
  // 1. 如果已有 content 且是 base64，直接返回
  if (file.content) {
    if (file.content.startsWith('data:')) {
      return file.content;
    }
    // 🔥 如果 content 是 URL，不应该当作 base64 处理，需要下载
    if (file.content.startsWith('http://') || file.content.startsWith('https://')) {
      // 走下面的 URL 下载逻辑
    } else if (file.mimeType?.startsWith('text/') || file.type?.startsWith('text/')) {
      // 纯文本需要转换
      const textBase64 = btoa(unescape(encodeURIComponent(file.content)));
      return `data:${file.mimeType || file.type || 'text/plain'};base64,${textBase64}`;
    } else if (file.content.length > 100) {
      // 可能是纯 base64 字符串
      return `data:${file.mimeType || file.type || 'application/octet-stream'};base64,${file.content}`;
    }
  }

  // 2. 如果有 url 且是外部 URL，下载获取
  const url = (file as any).url || file.storageUrl || (file.content && (file.content.startsWith('http://') || file.content.startsWith('https://')) ? file.content : null);
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    // 🔥 优先本地下载
    try {
      console.log('📥 [RESULT-FILE-STORAGE] 优先本地下载:', url.substring(0, 80) + '...');
      const base64 = await urlToBase64(url, file.mimeType || file.type);
      if (base64) {
        console.log('✅ [RESULT-FILE-STORAGE] 本地下载成功');
        return base64;
      }
    } catch (localError) {
      console.warn('⚠️ [RESULT-FILE-STORAGE] 本地下载失败，尝试云端下载:', localError);
    }

    // 🔥 本地下载失败，尝试云端下载
    try {
      console.log('☁️ [RESULT-FILE-STORAGE] 云端下载...');
      const downloadResult = await DownloadService.downloadFile({
        url: url,
        fileName: file.name,
        fileType: file.mimeType || file.type || 'application/octet-stream'
      });

      if (!downloadResult.success) {
        console.error('❌ [RESULT-FILE-STORAGE] 云端下载失败:', downloadResult.error);
        return null;
      }

      console.log('✅ [RESULT-FILE-STORAGE] 云端下载成功');
      return downloadResult.base64 || null;
    } catch (cloudError) {
      console.error('❌ [RESULT-FILE-STORAGE] 云端下载异常:', cloudError);
      return null;
    }
  }

  return null;
}

/**
 * 🔥 强制上传文件到云端存储
 * 忽略当前存储模式，强制使用云端存储
 * 
 * @param file - 文件对象
 * @param snapshotId - 快照ID（可选）
 * @returns 操作结果，包含更新后的文件对象（带有 url 和 storageUrl）
 */
export async function uploadFileToCloud(
  file: UnifiedFileAttachment | FileAttachment,
  snapshotId?: string
): Promise<FileOperationResult> {
  console.log('🔍 [UPLOAD-TO-CLOUD] 强制上传到云端:', {
    fileName: file.name,
    fileId: file.id,
    hasStorageUrl: !!file.storageUrl
  });
  
  // 直接调用云端存储处理函数，忽略当前存储模式
  return await handleCloudFileStorage(file, snapshotId);
}
