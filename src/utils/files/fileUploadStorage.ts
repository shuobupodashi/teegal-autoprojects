import { FileAttachment } from '@/components/workspace/types/ChatTypes';
import { toast } from 'sonner';

/**
 * 文件上传到存储的统一工具
 * 用于 FileUploader 组件在用户选择文件后立即上传
 * 🔥 优化：内联进度显示，移除侵入式toast通知
 */

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// 🔥 上传进度回调类型：增加uploadedFile参数
type ProgressCallback = (fileId: string, progress: number, status: FileAttachment['uploadStatus'], uploadedFile?: FileAttachment) => void;

/**
 * 批量上传文件到存储（兼容旧接口）
 * @deprecated 使用 createFilePreviews 代替
 */
export async function uploadFilesToStorage(
  files: File[],
  onProgress?: ProgressCallback
): Promise<FileAttachment[]> {
  return createFilePreviews(files, onProgress);
}

/**
 * 将 File 对象转换为 base64
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 创建文件预览对象（立即返回，不等待上传）
 * @param file - 原始File对象
 */
export async function createFilePreview(file: File): Promise<FileAttachment | null> {
  try {
    // 1. 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(1);
      const maxMB = (MAX_FILE_SIZE / 1024 / 1024).toFixed(0);
      toast.error(`文件过大：${file.name} (${sizeMB}MB)，最大允许 ${maxMB}MB`);
      return null;
    }

    // 2. 转换为 base64（保留原始内容）
    const base64Content = await fileToBase64(file);

    // 3. 创建初始 FileAttachment 对象（带pending状态）
    const fileAttachment: FileAttachment = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: file.name,
      type: file.type || 'application/octet-stream',
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      content: base64Content, // 保持原值
      url: base64Content, // 临时使用 base64
      isUploaded: false,
      uploadStatus: 'pending',
      uploadProgress: 0,
    };

    return fileAttachment;
  } catch (error) {

    return null;
  }
}

/**
 * 🔥 清洗 OSS 对象键里的文件名：非 [字母数字._-] 一律替换为 _
 * 带空格/括号的文件名（如浏览器重复下载的 "xxx (1).mp4"）会生成含空格的 URL，
 * 下游所有按空白截断的 URL 提取正则（SummaryModule 多模态、urlread 工具参数清洗）都会被截断，
 * 且模型 API 拉取含空格 URL 也会失败——在源头清洗是最可靠的修法
 */
export function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.-]/g, '_');
}

/**
 * 上传单个文件到存储（后台执行）
 * @param fileAttachment - 已创建的FileAttachment对象
 * @param onProgress - 进度回调函数（可选）
 */
export async function uploadFileToStorage(
  fileAttachment: FileAttachment,
  onProgress?: ProgressCallback
): Promise<FileAttachment> {
  try {
    const { content, name, type, id } = fileAttachment;

    // 开始上传（通过回调更新状态，无百分比）

    if (onProgress) {
      onProgress(id, 0, 'uploading');
    }

    // 🔥 添加小延迟确保uploading状态可见（至少500ms）
    const startTime = Date.now();

    const { StorageFactory } = await import('@/utils/storage/StorageFactory');
    const storageProvider = StorageFactory.getDefaultProvider();

    const uploadPath = `${Date.now()}-${Math.random().toString(36).substring(2)}-${sanitizeFileName(name)}`;
    
    const uploadResult = await storageProvider.upload(
      'downloaded-files',
      uploadPath,
      content!,
      {
        contentType: type || 'application/octet-stream',
        upsert: false,
      }
    );

    if (uploadResult.success && uploadResult.url) {
      // 🔥 确保uploading状态至少显示500ms
      const elapsed = Date.now() - startTime;
      if (elapsed < 500) {
        await new Promise(resolve => setTimeout(resolve, 500 - elapsed));
      }

      // 5. 上传成功，更新 storageUrl 和 url，保持 content 原值
      const uploadedFile: FileAttachment = {
        ...fileAttachment,
        storageUrl: uploadResult.url,
        url: uploadResult.url,
        isUploaded: true,
        uploadTimestamp: Date.now(),
        uploadStatus: 'success',
        uploadProgress: 100,
      };

      // 🔥 通过回调更新进度为100%，并传递完整的文件对象
      if (onProgress) {
        onProgress(id, 100, 'success', uploadedFile);
      }


      return uploadedFile;
    } else {
      // 6. 上传失败，返回本地版本（仍可使用）
      const failedFile: FileAttachment = {
        ...fileAttachment,
        uploadStatus: 'error',
        uploadError: uploadResult.error || '上传失败',
      };
      
      // 🔥 通过回调更新状态为error
      if (onProgress) {
        onProgress(id, 0, 'error');
      }
      

      return failedFile;
    }
  } catch (error) {

    // 🔥 异常时返回error状态的文件对象
    const errorFile: FileAttachment = {
      ...fileAttachment,
      uploadStatus: 'error',
      uploadError: '上传异常',
    };
    if (onProgress) {
      onProgress(fileAttachment.id, 0, 'error');
    }
    return errorFile;
  }
}

/**
 * 🔥 上传去重缓存：同一文件（名称+大小+修改时间指纹一致）第二次选择时
 * 直接复用已上传的 OSS URL，不再重传（视频生成/剪辑场景同一素材会被反复
 * 引用，重传大文件既慢又重复占用存储）。缓存的条目不带 content（省内存），
 * 显示预览时才按需读取本地文件。
 */
const uploadedFileCache = new Map<string, FileAttachment>();
const UPLOADED_CACHE_MAX = 20;

function fileFingerprint(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

/**
 * 批量创建文件预览并后台上传
 * @param files - 文件数组
 * @param onProgress - 进度回调函数（可选）
 * @returns 立即返回文件预览数组，后台异步上传
 */
export async function createFilePreviews(
  files: File[],
  onProgress?: ProgressCallback
): Promise<FileAttachment[]> {
  const previews: FileAttachment[] = [];
  // 指纹登记表：上传成功后按 id 回填缓存（createFilePreview 生成的 id 在这里才与 File 对应）
  const pendingFingerprints = new Map<string, string>();

  // 🔥 第一步：立即创建所有文件预览（快速返回）；命中缓存的直接复用已上传的 URL
  for (const file of files) {
    const fp = fileFingerprint(file);
    const cached = uploadedFileCache.get(fp);
    if (cached?.storageUrl) {
      // 复用：新 id 新预览（UI 正常显示），content 重新读取仅用于本地预览显示，
      // url/storageUrl 沿用第一次上传的结果，uploadStatus 直接 success
      previews.push({
        ...cached,
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        content: await fileToBase64(file),
        url: cached.storageUrl,
        isUploaded: true,
        uploadStatus: 'success',
        uploadProgress: 100,
        uploadError: undefined,
      });
      continue;
    }
    const preview = await createFilePreview(file);
    if (preview) {
      previews.push(preview);
      pendingFingerprints.set(preview.id, fp);
    }
  }

  // 🔥 第二步：立即启动后台上传（在返回previews之前）
  // 使用 setTimeout 确保在下一个事件循环中执行，让UI先渲染
  setTimeout(() => {
    previews.forEach(preview => {
      const fp = pendingFingerprints.get(preview.id);
      if (!fp) return; // 缓存命中的已带 success 状态，跳过上传
      uploadFileToStorage(preview, onProgress)
        .then(result => {
          // 上传成功后回填缓存（剥离 content 省内存：缓存只存 URL 元信息）
          if (result.uploadStatus === 'success' && result.storageUrl) {
            const { content, ...meta } = result;
            uploadedFileCache.set(fp, meta as FileAttachment);
            // 超量淘汰最早的条目（Map 按插入序迭代）
            if (uploadedFileCache.size > UPLOADED_CACHE_MAX) {
              const oldest = uploadedFileCache.keys().next().value;
              if (oldest !== undefined) uploadedFileCache.delete(oldest);
            }
          }
        })
        .catch(error => {
        });
    });
  }, 0);

  return previews;
}
