/**
 * 文件下载服务
 * 调用 Home Web 的下载 API
 */

import { CloudAuthService } from './cloud/CloudAuthService';

import { CLOUD_API_BASE_URL } from '@/config/api';
const CLOUD_API_URL = CLOUD_API_BASE_URL;

export interface DownloadFileOptions {
  url: string;
  fileName?: string;
  fileType?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface DownloadFileResult {
  success: boolean;
  base64?: string;
  originalUrl?: string;
  fileName?: string;
  fileType?: string;
  size?: number;
  error?: string;
}

/**
 * 下载文件服务
 */
export class DownloadService {
  /**
   * 通过代理下载文件
   */
  static async downloadFile(options: DownloadFileOptions): Promise<DownloadFileResult> {
    try {
      const backendUrl = CLOUD_API_URL.replace('/api', '');
      const token = CloudAuthService.getAccessToken();

      console.log('📥 [DOWNLOAD-SERVICE] 开始下载文件:', {
        url: options.url.substring(0, 100) + '...',
        fileName: options.fileName,
      });

      const response = await fetch(`${backendUrl}/api/download/file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `下载失败: ${response.status}`);
      }

      const result: DownloadFileResult = await response.json();

      console.log('✅ [DOWNLOAD-SERVICE] 下载完成:', {
        success: result.success,
        fileName: result.fileName,
        size: result.size,
        hasBase64: !!result.base64,
      });

      return result;
    } catch (error) {
      console.error('❌ [DOWNLOAD-SERVICE] 下载失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '下载失败',
      };
    }
  }
}
