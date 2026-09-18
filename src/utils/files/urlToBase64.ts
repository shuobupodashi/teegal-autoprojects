/**
 * URL 转 Base64 工具
 * 提供统一的 URL 下载和 Base64 转换方法
 */
import { DownloadService } from "@/services/DownloadService";

/**
 * 检查是否在 Electron 环境中
 */
function isElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electron?.isElectron;
}

/**
 * 下载 URL 并转换为 Base64
 * @param url 要下载的 URL（支持 HTTP/HTTPS）
 * @param mimeType 可选的 MIME 类型，如果不提供则自动检测
 * @returns Base64 字符串（data:image/png;base64,... 格式）
 */
export async function urlToBase64(url: string, mimeType?: string): Promise<string> {
  try {
    console.log('📥 [URL-TO-BASE64] 开始下载URL:', {
      url: url.substring(0, 100) + '...',
      mimeType
    });

    // 如果已经是 base64，直接返回
    if (url.startsWith('data:')) {
      console.log('✅ [URL-TO-BASE64] 已经是Base64格式，直接返回');
      return url;
    }

    // 🔥 Electron 环境：优先使用主进程下载（绕过 CORS）
    if (isElectron()) {
      console.log('🖥️ [URL-TO-BASE64] Electron环境，使用主进程下载');
      try {
        const result = await (window as any).electron.downloadUrl({ url, mimeType });
        if (result.success && result.base64) {
          console.log('✅ [URL-TO-BASE64] 主进程下载成功:', { size: result.size });
          return result.base64;
        }
        console.warn('⚠️ [URL-TO-BASE64] 主进程下载失败:', result.error);
      } catch (electronError) {
        console.warn('⚠️ [URL-TO-BASE64] 主进程下载异常:', electronError);
      }
      // 主进程下载失败，继续尝试其他方式
    }

    // 🔥 火山 TOS 等易触发跨域的域名先走服务端代理
    if (isVolcTosUrl(url)) {
      return await downloadViaProxy(url, mimeType);
    }

    // 下载文件
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status} ${response.statusText}`);
    }

    // 获取 Blob
    const blob = await response.blob();
    
    // 确定 MIME 类型
    const finalMimeType = mimeType || blob.type || 'application/octet-stream';
    
    console.log('📦 [URL-TO-BASE64] 文件下载成功:', {
      size: blob.size,
      type: finalMimeType
    });

    // 转换为 Base64
    const base64 = await blobToBase64(blob, finalMimeType);
    
    console.log('✅ [URL-TO-BASE64] 转换完成:', {
      base64Length: base64.length,
      preview: base64.substring(0, 50) + '...'
    });

    return base64;
  } catch (error) {
    console.warn('⚠️ [URL-TO-BASE64] 直连下载失败，尝试走代理:', error);
    // 🔁 失败时回退到服务端代理，绕过浏览器CORS
    return await downloadViaProxy(url, mimeType);
  }
}

/**
 * Blob 转 Base64
 * @param blob Blob 对象
 * @param mimeType MIME 类型
 * @returns Base64 字符串（data:image/png;base64,... 格式）
 */
export function blobToBase64(blob: Blob, mimeType?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      const result = reader.result as string;
      
      // 如果提供了自定义 MIME 类型，替换默认的
      if (mimeType && result.startsWith('data:')) {
        const base64Data = result.split(',')[1];
        resolve(`data:${mimeType};base64,${base64Data}`);
      } else {
        resolve(result);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Blob转Base64失败'));
    };
    
    reader.readAsDataURL(blob);
  });
}

/**
 * 批量下载 URL 并转换为 Base64
 * @param urls URL 数组
 * @param mimeType 可选的统一 MIME 类型
 * @returns Base64 字符串数组
 */
export async function urlsToBase64Batch(urls: string[], mimeType?: string): Promise<string[]> {
  console.log('📥 [URL-TO-BASE64-BATCH] 批量转换:', {
    count: urls.length
  });

  const results = await Promise.all(
    urls.map(async (url, index) => {
      try {
        const base64 = await urlToBase64(url, mimeType);
        console.log(`✅ [URL-TO-BASE64-BATCH] 转换成功 ${index + 1}/${urls.length}`);
        return base64;
      } catch (error) {
        console.error(`❌ [URL-TO-BASE64-BATCH] 转换失败 ${index + 1}/${urls.length}:`, error);
        throw error;
      }
    })
  );

  console.log('✅ [URL-TO-BASE64-BATCH] 批量转换完成:', {
    total: urls.length,
    success: results.length
  });

  return results;
}

export function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function isVolcTosUrl(url: string): boolean {
  return /tos-.*\.volces\.com|ark-content-generation.*volces\.com/i.test(url);
}

async function downloadViaProxy(url: string, mimeType?: string): Promise<string> {
  try {
    const fileName = (() => {
      const noQuery = url.split('?')[0];
      const name = noQuery.split('/').pop() || 'download.bin';
      return name;
    })();

    console.log('🔄 [URL-TO-BASE64] 调用代理下载:', {
      url: url.substring(0, 100) + '...',
      fileName,
      mimeType
    });

    // 🔥 使用 DownloadService 代理下载
    const result = await DownloadService.downloadFile({
      url,
      fileName,
      fileType: mimeType || 'application/octet-stream',
    });

    console.log('📦 [URL-TO-BASE64] 代理下载响应:', {
      success: result.success,
      hasBase64: !!result.base64,
      error: result.error,
    });

    if (!result.success || !result.base64) {
      console.error('❌ [URL-TO-BASE64] 服务端响应无效:', result);
      throw new Error(result.error || '服务端代理未返回有效base64');
    }

    console.log('✅ [URL-TO-BASE64] 代理下载成功:', {
      size: result.size,
      base64Length: result.base64.length
    });

    return result.base64;
  } catch (e) {
    console.error('❌ [URL-TO-BASE64] 代理下载失败:', e);
    throw new Error(e instanceof Error ? e.message : String(e));
  }
}
