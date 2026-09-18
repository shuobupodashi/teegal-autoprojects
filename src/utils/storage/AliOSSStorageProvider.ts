
import { IStorageProvider, StorageUploadResult, StorageDeleteResult } from './StorageProvider';
import { FileAttachment } from '@/components/workspace/types/ChatTypes'; // 🔥 新增：导入FileAttachment类型
import { getBackendUrl } from '@/config/api';

export class AliOSSStorageProvider implements IStorageProvider {
  private region: string;
  private bucket: string;

  constructor() {
    // 从环境变量读取配置（.env 的 VITE_ALIYUN_OSS_BUCKET/REGION）；bucket 未配置时上传会失败
    this.region = import.meta.env.VITE_ALIYUN_OSS_REGION || 'oss-cn-hangzhou';
    this.bucket = import.meta.env.VITE_ALIYUN_OSS_BUCKET || '';
    if (!this.bucket) {
      console.warn('⚠️ [AliOSSStorageProvider] 未配置 VITE_ALIYUN_OSS_BUCKET，对象存储上传将不可用');
    }
  }

  /**
   * 🔥 修改：支持File、Blob和string(data:URL)三种类型
   * 避免不必要的base64转换
   */
  async upload(
    bucket: string,
    path: string,
    file: File | Blob | string,
    options?: { contentType?: string; upsert?: boolean }
  ): Promise<StorageUploadResult> {
    try {
      // 🔥 直接通过ECS后端上传到OSS（避免签名和上传分离的时间差问题）
      const result = await this.uploadDirectToOSS(
        path, 
        file, 
        options?.contentType || this.getFileContentType(file)
      );
      
      if (result.success) {
        return result;
      }
      
      // 🔥 如果ECS后端上传失败，返回错误信息
      console.error('ECS backend upload failed:', result.error);
      return result;
    } catch (error) {
      console.error('ECS backend upload error:', error);
      // 🔥 如果ECS后端上传失败，返回错误信息
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * 🔥 新增：获取文件的ContentType
   */
  private getFileContentType(file: File | Blob | string): string {
    if (typeof file === 'string') {
      // string - 从 data:URL 中提取 MIME 类型
      if (file.startsWith('data:')) {
        const match = file.match(/^data:([^;]+);/);
        if (match) return match[1];
      }
      return 'application/octet-stream';
    } else if ('type' in file && file.type) {
      // File或Blob对象
      return file.type;
    }
    return 'application/octet-stream';
  }

  /**
   * 🔥 通过ECS后端直接上传到OSS（避免签名和上传分离的时间差问题）
   * 注意：签名生成和文件上传必须在同一个函数调用中完成，以避免OSS的时间验证问题
   * 🔥 修改：支持string(data:URL)，直接使用content字段的base64数据
   */
  private async uploadDirectToOSS(
    path: string,
    file: File | Blob | string,
    contentType: string
  ): Promise<StorageUploadResult> {
    try {
      // 🔥 使用统一配置获取正确的 local-backend URL
      const resolvedBackendUrl = getBackendUrl();
      
      console.log('🔍 [AliOSSStorageProvider] 使用 local-backend URL:', resolvedBackendUrl);
      
      // 🔥 修改：判断是 string(data:URL) 还是 File/Blob，统一处理base64数据
      let fileBase64: string;
      if (typeof file === 'string') {
        // string - data:URL格式
        if (file.startsWith('data:')) {
          // 如果是data URL，移除前缀
          fileBase64 = file.split(',')[1];
          console.log('✅ [AliOSSStorageProvider] 检测到data URL，去除前缀后使用');
        } else if (file.startsWith('http')) {
          // 如果已经是URL，直接返回，无需上传
          console.log('✅ [AliOSSStorageProvider] 文件已有URL，跳过上传');
          return {
            success: true,
            url: file,
            path: path
          };
        } else {
          // 已经是纯base64
          fileBase64 = file;
          console.log('✅ [AliOSSStorageProvider] 检测到纯base64，直接使用');
        }
      } else {
        // File或Blob - 需要转换为base64（自动去除前缀）
        fileBase64 = await this.fileToBase64(file as File | Blob);
        console.log('✅ [AliOSSStorageProvider] File/Blob转换为base64（已去除前缀）');
      }
      
      console.log('🔍 [AliOSSStorageProvider] 请求ECS直接上传:', {
        ecsBackendUrl: resolvedBackendUrl,
        path,
        contentType,
        bucket: this.bucket
      });
      
      // 请求ECS后端直接上传到OSS
      const uploadResponse = await fetch(`${resolvedBackendUrl}/oss/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path,
          contentType,
          bucket: this.bucket,
          fileBase64
        })
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload to OSS: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }
      
      const uploadData = await uploadResponse.json();
      
      if (!uploadData.success) {
        throw new Error(`Failed to upload to OSS: ${uploadData.error}`);
      }
      
      // 记录调试信息
      console.log('🔍 [AliOSSStorageProvider] OSS上传成功:', {
        url: uploadData.url,
        path: uploadData.path
      });
      
      return {
        success: true,
        url: uploadData.url,
        path: uploadData.path
      };
    } catch (error) {
      console.error('❌ [AliOSSStorageProvider] 上传到OSS失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Direct OSS upload failed'
      };
    }
  }

  getPublicUrl(bucket: string, path: string): string {
    // OSS 公共 URL 格式
    return `https://${this.bucket}.${this.region}.aliyuncs.com/${path}`;
  }

  async delete(bucket: string, path: string): Promise<StorageDeleteResult> {
    try {
      // 🔥 使用统一配置获取正确的 local-backend URL
      const resolvedBackendUrl = getBackendUrl();
      
      console.log('🔍 [AliOSSStorageProvider] 删除文件使用 local-backend URL:', resolvedBackendUrl);
      
      const response = await fetch(`${resolvedBackendUrl}/oss/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path,
          bucket: this.bucket
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete OSS file: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(`Failed to delete OSS file: ${data.error}`);
      }
      
      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed'
      };
    }
  }

  getProviderName(): string {
    return 'alioss';
  }

  private async fileToBase64(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // 移除 data URL 前缀，只保留 base64 数据
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}