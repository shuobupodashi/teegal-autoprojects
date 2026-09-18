/**
 * 🔥 上传本地文件到云端 OSS，返回公共访问 URL
 *
 * 适用场景：
 * - 训练数据上传：将本地 CSV/JSON 等数据文件上传到云端，训练时直接从 URL 加载
 * - 文件分享：获取文件的公共访问链接
 *
 * 已从扩展工具迁移为内置工具（稳定功能，不应让 LLM 随便修改）
 */

import { AutoStep, AutoToolResult } from '@/utils/auto/types';
import { sanitizeFileName } from '@/utils/files/fileUploadStorage';

interface UploadContext {
  userId: string;
  conversationId?: string;
}

export async function executeUploadFileToOsSTool(
  step: AutoStep,
  _planId: string,
  context?: UploadContext
): Promise<AutoToolResult> {
  const params = step.toolParams || step.parameters || {};
  const localPaths = extractLocalPaths(params);

  if (localPaths.length === 0) {
    return {
      success: false,
      error: '未找到有效的本地文件路径。请提供包含路径的参数，如 localPath 或 query',
    };
  }

  try {
    const electron = (window as any).electron;
    if (!electron) {
      return {
        success: false,
        error: 'Electron API 不可用，无法读取本地文件',
      };
    }

    const { StorageFactory } = await import('@/utils/storage/StorageFactory');
    const storageProvider = StorageFactory.getDefaultProvider();

    const uploadResults: Array<{
      localPath: string;
      url?: string;
      fileName: string;
      fileSize?: number;
      error?: string;
    }> = [];

    for (const localPath of localPaths) {
      try {
        const readResult = await electron.readLocalFile({ localPath });
        if (!readResult.success) {
          uploadResults.push({
            localPath,
            fileName: localPath.split(/[/\\]/).pop() || 'file',
            error: `读取失败: ${readResult.error}`,
          });
          continue;
        }

        const fileName = localPath.split(/[/\\]/).pop() || 'file';
        const mimeType = getMimeType(fileName);
        const base64Content = readResult.content;
        const dataUrl = `data:${mimeType};base64,${base64Content}`;

        const uploadPath = `${Date.now()}-${Math.random().toString(36).substring(2)}-${sanitizeFileName(fileName)}`;
        const uploadResult = await storageProvider.upload(
          'uploaded-files',
          uploadPath,
          dataUrl,
          { contentType: mimeType, upsert: false }
        );

        if (!uploadResult.success || !uploadResult.url) {
          uploadResults.push({
            localPath,
            fileName,
            error: `上传失败: ${uploadResult.error || '未知错误'}`,
          });
          continue;
        }

        const fileSize = Math.ceil((base64Content.length * 3) / 4);
        uploadResults.push({
          localPath,
          url: uploadResult.url,
          fileName,
          fileSize,
        });

        // 🔥 上传成功后登记到 dse_files 表，供 list_cloud_files 工具查询
        try {
          const fileType = getFileType(fileName);
          const isDev = import.meta.env.DEV;
          const apiUrl = isDev
            ? '/api/ecs-worker/api/local/dse-files'
            : 'http://localhost:3001/api/local/dse-files';
          await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: context?.userId,
              file_name: fileName,
              file_size: fileSize,
              file_type: fileType,
              oss_url: uploadResult.url,
              oss_path: uploadPath,
              local_path: localPath,
            }),
          });
        } catch (dbErr) {
          console.warn('[uploadfiletooss] 登记 dse_files 失败（不影响上传结果）:', dbErr);
        }

        console.log(`[uploadfiletooss] 上传成功: ${fileName} -> ${uploadResult.url}`);
      } catch (err) {
        uploadResults.push({
          localPath,
          fileName: localPath.split(/[/\\]/).pop() || 'file',
          error: err instanceof Error ? err.message : '上传异常',
        });
      }
    }

    const successCount = uploadResults.filter(r => r.url).length;
    const failCount = uploadResults.length - successCount;

    if (successCount === 0) {
      return {
        success: false,
        error: `所有文件上传失败: ${uploadResults.map(r => r.error).join('; ')}`,
      };
    }

    return {
      success: true,
      data: {
        files: uploadResults,
        successCount,
        failCount,
        summary: `成功上传 ${successCount} 个文件${failCount > 0 ? `，失败 ${failCount} 个` : ''}`,
      },
    };
  } catch (error) {
    console.error('[uploadfiletooss] 执行失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '上传失败',
    };
  }
}

function extractLocalPaths(params: Record<string, any>): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();

  const pathPattern = /^(?:[a-zA-Z]:[/\\]|\/|~\/)/;

  function extractFromValue(value: any): void {
    if (typeof value === 'string') {
      if (pathPattern.test(value) && !seen.has(value)) {
        seen.add(value);
        paths.push(value);
      }
    } else if (Array.isArray(value)) {
      value.forEach(extractFromValue);
    } else if (typeof value === 'object' && value !== null) {
      Object.values(value).forEach(extractFromValue);
    }
  }

  Object.values(params).forEach(extractFromValue);

  return paths;
}

function getFileType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) return 'image';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'zip';
  if (['csv', 'json', 'txt', 'md', 'xml'].includes(ext)) return 'csv';
  if (['pt', 'onnx', 'bin', 'h5', 'pth'].includes(ext)) return 'model';
  return 'other';
}

function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    csv: 'text/csv',
    json: 'application/json',
    txt: 'text/plain',
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    mp4: 'video/mp4',
    mp3: 'audio/mpeg',
    zip: 'application/zip',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
