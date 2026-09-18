/**
 * 🔥 后端 OSS 上传工具
 * 使用预签名 URL 上传文件到阿里云 OSS
 *
 * 流程：
 * 1. 从 home-web 获取预签名 URL
 * 2. 使用预签名 URL 直接 PUT 上传到 OSS
 * 3. 预签名 URL 有过期时间，更安全
 */

import { promises as fs } from 'fs';
import path from 'path';
import { ossCredentialManager } from './OSSCredentialManager';

interface OSSUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * 上传单个文件到 OSS
 */
export async function uploadFileToOSS(
  localFilePath: string,
  ossPath: string,
  contentType: string = 'application/octet-stream'
): Promise<OSSUploadResult> {
  try {
    // 🔐 获取预签名 URL
    const { presignedUrl, publicUrl } = await ossCredentialManager.getPresignedUrl(
      ossPath,
      contentType,
      3600 // 1小时有效期
    );

    console.log('🔐 [OSS-UTIL] 使用预签名 URL 上传:', {
      ossPath,
      contentType
    });

    // 读取文件
    const fileBuffer = await fs.readFile(localFilePath);

    // 使用预签名 URL 直接上传到 OSS
    const uploadResponse = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType
      },
      body: fileBuffer
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('❌ [OSS-UTIL] 上传失败:', {
        ossPath,
        status: uploadResponse.status,
        statusText: uploadResponse.statusText,
        error: errorText
      });
      return {
        success: false,
        error: `OSS upload failed: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`
      };
    }

    console.log('✅ [OSS-UTIL] 上传成功:', publicUrl);

    return {
      success: true,
      url: publicUrl
    };
  } catch (error) {
    console.error('❌ [OSS-UTIL] 上传异常:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error'
    };
  }
}

/**
 * 上传 Buffer 到 OSS
 */
export async function uploadBufferToOSS(
  buffer: Buffer,
  ossPath: string,
  contentType: string = 'application/octet-stream'
): Promise<OSSUploadResult> {
  try {
    // 🔐 获取预签名 URL
    const { presignedUrl, publicUrl } = await ossCredentialManager.getPresignedUrl(
      ossPath,
      contentType,
      3600 // 1小时有效期
    );

    console.log('🔐 [OSS-UTIL] 使用预签名 URL 上传 Buffer:', {
      ossPath,
      contentType,
      size: buffer.length
    });

    // 使用预签名 URL 直接上传到 OSS
    const uploadResponse = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType
      },
      body: buffer
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('❌ [OSS-UTIL] Buffer 上传失败:', {
        ossPath,
        status: uploadResponse.status,
        statusText: uploadResponse.statusText,
        error: errorText
      });
      return {
        success: false,
        error: `OSS upload failed: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`
      };
    }

    console.log('✅ [OSS-UTIL] Buffer 上传成功:', publicUrl);

    return {
      success: true,
      url: publicUrl
    };
  } catch (error) {
    console.error('❌ [OSS-UTIL] Buffer 上传异常:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown upload error'
    };
  }
}

/**
 * 上传 Base64 数据到 OSS
 */
export async function uploadBase64ToOSS(
  base64Data: string,
  ossPath: string,
  contentType: string = 'application/octet-stream'
): Promise<OSSUploadResult> {
  try {
    // 处理 base64 数据
    let pureBase64 = base64Data;
    if (base64Data.startsWith('data:')) {
      pureBase64 = base64Data.split(',')[1];
    }

    // 转换为 Buffer
    const buffer = Buffer.from(pureBase64, 'base64');

    // 使用 uploadBufferToOSS 上传
    return await uploadBufferToOSS(buffer, ossPath, contentType);
  } catch (error) {
    console.error('❌ [OSS-UTIL] Base64 上传异常:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Base64 decode error'
    };
  }
}

/**
 * 上传 JSON 数据到 OSS
 */
export async function uploadJSONToOSS(
  data: any,
  ossPath: string
): Promise<OSSUploadResult> {
  const jsonString = JSON.stringify(data, null, 2);
  const buffer = Buffer.from(jsonString, 'utf-8');
  return await uploadBufferToOSS(buffer, ossPath, 'application/json');
}

/**
 * 批量上传文件到 OSS
 */
export async function uploadFilesToOSS(
  files: Array<{
    localPath: string;
    ossPath: string;
    contentType?: string;
  }>
): Promise<Array<OSSUploadResult & { ossPath: string }>> {
  const results: Array<OSSUploadResult & { ossPath: string }> = [];

  for (const file of files) {
    const result = await uploadFileToOSS(
      file.localPath,
      file.ossPath,
      file.contentType || 'application/octet-stream'
    );
    results.push({
      ...result,
      ossPath: file.ossPath
    });
  }

  return results;
}
