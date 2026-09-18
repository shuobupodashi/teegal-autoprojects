/**
 * App Output File Uploader
 * 🔥 自动检测 App 执行输出中的文件路径并上传到云端
 */

import { FileAttachment } from "@/components/workspace/types/ChatTypes";
import { uploadFileToCloud } from "@/utils/files/resultFileStorage";

export interface UploadedFileInfo {
  localPath: string;
  fileAttachment: FileAttachment;
  url: string;
}

/**
 * 🔥 检测文本中的文件路径（Windows 和 Unix 格式）
 */
export function detectFilePaths(text: string): Array<{ fullPath: string; isFile: boolean }> {
  const paths: Array<{ fullPath: string; isFile: boolean }> = [];
  const matchedRanges: Array<{ start: number; end: number }> = [];
  
  // 🔥 首先排除 URL（http://, https://, s3:// 等）
  const urlRegex = /[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s]+/g;
  const urlRanges: Array<{ start: number; end: number }> = [];
  let urlMatch;
  while ((urlMatch = urlRegex.exec(text)) !== null) {
    urlRanges.push({ start: urlMatch.index, end: urlMatch.index + urlMatch[0].length });
  }
  
  // Windows 路径: C:\Users\... 或 C:/Users/...
  // 🔥 使用负向回顾后发，确保前面不是另一个冒号（避免匹配 URL 的 scheme 部分）
  const windowsPathRegex = /(?<![a-zA-Z]:)[A-Za-z]:[\\/](?:[^\s]*[\\/])*[^\s]+/g;
  
  // Unix 路径: /home/user/... 或 /Users/user/...
  const unixPathRegex = /(?<![A-Za-z:])\/(?:home|Users|tmp|var|opt|usr|mnt|data|workspace)[\\/][^\s]+/g;
  
  // 匹配 Windows 路径
  let match;
  while ((match = windowsPathRegex.exec(text)) !== null) {
    const path = match[0];
    const start = match.index;
    const end = start + path.length;
    
    // 🔥 检查是否与 URL 范围重叠
    const isInUrl = urlRanges.some(range => 
      (start >= range.start && start < range.end) ||
      (end > range.start && end <= range.end) ||
      (start <= range.start && end >= range.end)
    );
    
    if (isInUrl) {
      console.log('[AppOutputFileUploader] 跳过 URL 中的路径:', path);
      continue;
    }
    
    if (/[A-Za-z]:[\\/][^\s]{2,}/.test(path)) {
      const hasExtension = /\.[^\\/\.]+$/.test(path);
      paths.push({ fullPath: path, isFile: hasExtension });
      matchedRanges.push({ start, end });
    }
  }
  
  // 匹配 Unix 路径
  while ((match = unixPathRegex.exec(text)) !== null) {
    const path = match[0];
    const start = match.index;
    const end = start + path.length;
    
    const isOverlapping = matchedRanges.some(range => 
      (start >= range.start && start < range.end) ||
      (end > range.start && end <= range.end) ||
      (start <= range.start && end >= range.end)
    );
    
    if (!isOverlapping && /\/(?:home|Users|tmp|var|opt|usr|mnt|data|workspace)[\\/][^\s]{2,}/.test(path)) {
      const hasExtension = /\.[^\\/\.]+$/.test(path);
      paths.push({ fullPath: path, isFile: hasExtension });
    }
  }
  
  // 去重
  const uniquePaths = paths.filter((item, index, self) => 
    index === self.findIndex((t) => t.fullPath === item.fullPath)
  );
  
  return minimizePaths(uniquePaths);
}

/**
 * 🔥 路径层级最小化
 */
function minimizePaths(paths: Array<{ fullPath: string; isFile: boolean }>): Array<{ fullPath: string; isFile: boolean }> {
  if (paths.length <= 1) return paths;
  
  const sorted = [...paths].sort((a, b) => b.fullPath.length - a.fullPath.length);
  const result: Array<{ fullPath: string; isFile: boolean }> = [];
  
  for (const current of sorted) {
    const isParentOfExisting = result.some(existing => {
      const currentNormalized = current.fullPath.replace(/\\/g, '/');
      const existingNormalized = existing.fullPath.replace(/\\/g, '/');
      return existingNormalized.startsWith(currentNormalized + '/') ||
             existingNormalized === currentNormalized;
    });
    
    if (!isParentOfExisting) {
      result.push(current);
    }
  }
  
  return result;
}

/**
 * 🔥 上传单个文件到云端
 */
async function uploadSingleFile(localPath: string): Promise<UploadedFileInfo | null> {
  try {
    const electron = (window as any).electron;
    if (!electron?.readLocalFile) {
      console.warn('[AppOutputFileUploader] 不在桌面版环境中，无法读取本地文件');
      return null;
    }

    const readResult = await electron.readLocalFile({ localPath });
    if (!readResult.success || !readResult.content) {
      console.warn('[AppOutputFileUploader] 读取文件失败:', readResult.error);
      return null;
    }

    const fileName = localPath.split(/[\\/]/).pop() || 'file';
    const fileAttachment: FileAttachment = {
      id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: fileName,
      type: 'application/octet-stream',
      content: readResult.content,
      source: 'step_output'
    };

    const uploadResult = await uploadFileToCloud(fileAttachment);

    if (uploadResult.success && uploadResult.file) {
      const uploadedFile = uploadResult.file as FileAttachment;
      const url = uploadedFile.url || uploadedFile.storageUrl;
      
      if (url) {
        console.log('[AppOutputFileUploader] 文件上传成功:', { localPath, url });
        return {
          localPath,
          fileAttachment: uploadedFile,
          url
        };
      }
    }

    console.warn('[AppOutputFileUploader] 上传失败:', uploadResult.error);
    return null;
  } catch (error) {
    console.error('[AppOutputFileUploader] 上传异常:', error);
    return null;
  }
}

/**
 * 🔥 自动检测并上传输出中的文件
 */
export async function uploadOutputFiles(
  output: string,
  conversationId?: string
): Promise<UploadedFileInfo[]> {
  if (!output) return [];

  console.log('[AppOutputFileUploader] 开始检测输出中的文件路径');
  
  const detectedPaths = detectFilePaths(output);
  const filePaths = detectedPaths.filter(p => p.isFile);
  
  console.log('[AppOutputFileUploader] 检测到的文件路径:', filePaths.map(p => p.fullPath));

  if (filePaths.length === 0) {
    return [];
  }

  const uploadedFiles: UploadedFileInfo[] = [];

  for (const { fullPath } of filePaths) {
    const result = await uploadSingleFile(fullPath);
    if (result) {
      uploadedFiles.push(result);
    }
  }

  console.log('[AppOutputFileUploader] 上传完成:', { 
    total: filePaths.length, 
    success: uploadedFiles.length 
  });

  return uploadedFiles;
}

/**
 * 🔥 将输出中的文件路径替换为 URL
 */
export function replacePathsWithUrls(
  output: string,
  uploadedFiles: UploadedFileInfo[]
): string {
  let result = output;
  
  for (const { localPath, url } of uploadedFiles) {
    // 转义正则特殊字符
    const escapedPath = localPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedPath, 'g');
    result = result.replace(regex, url);
  }
  
  return result;
}