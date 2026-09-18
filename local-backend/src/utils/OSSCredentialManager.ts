/**
 * 🔐 OSS 凭证管理器
 * 负责从 home-web 获取 OSS 预签名上传 URL
 *
 * 使用预签名 URL 方式上传：
 * 1. 客户端请求服务端生成预签名 URL
 * 2. 客户端使用预签名 URL 直接 PUT 上传到 OSS
 * 3. 预签名 URL 有过期时间，更安全
 */

import axios from 'axios';

interface PresignedUrlResponse {
  success: boolean;
  presignedUrl?: string;
  publicUrl?: string;
  objectKey?: string;
  expiresIn?: number;
  error?: string;
}

interface OSSConfigResponse {
  success: boolean;
  credentials?: {
    accessKeyId: string;
    endpoint: string;
    bucket: string;
    region: string;
    expiration: string;
  };
  error?: string;
}

export class OSSCredentialManager {
  private homeWebUrl: string;
  private cachedConfig: {
    endpoint: string;
    bucket: string;
    region: string;
    expiration: string;
  } | null = null;

  constructor(homeWebUrl?: string) {
    // 🔥 默认指向 home-web (ECS 服务端)，可通过环境变量配置
    this.homeWebUrl = homeWebUrl || process.env.HOME_WEB_URL || 'https://www.workbees.space';
  }

  /**
   * 📡 从 home-web 获取 OSS 基础配置
   */
  async fetchConfig(userId?: string): Promise<{ endpoint: string; bucket: string; region: string }> {
    try {
      console.log(`📡 [OSS-CredentialManager] 正在向 home-web 请求 OSS 配置`);

      const response = await axios.post<OSSConfigResponse>(
        `${this.homeWebUrl}/api/oss-sts`,
        {
          userId: userId || 'anonymous',
          timestamp: Date.now()
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data.success || !response.data.credentials) {
        throw new Error(response.data.error || '获取 OSS 配置失败');
      }

      const { endpoint, bucket, region, expiration } = response.data.credentials;
      this.cachedConfig = { endpoint, bucket, region, expiration };

      console.log(`✅ [OSS-CredentialManager] 成功获取 OSS 配置: ${bucket}.${region}`);

      return { endpoint, bucket, region };

    } catch (error) {
      console.error('❌ [OSS-CredentialManager] 获取 OSS 配置失败:', error);
      throw error;
    }
  }

  /**
   * 🔐 获取预签名上传 URL
   * 客户端使用此 URL 直接 PUT 上传到 OSS
   */
  async getPresignedUrl(
    objectKey: string,
    contentType: string = 'application/octet-stream',
    expirySeconds: number = 3600
  ): Promise<{ presignedUrl: string; publicUrl: string }> {
    try {
      console.log(`📡 [OSS-CredentialManager] 正在请求预签名 URL: ${objectKey}`);

      const response = await axios.post<PresignedUrlResponse>(
        `${this.homeWebUrl}/api/oss-sts/presign`,
        {
          objectKey,
          contentType,
          expirySeconds
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data.success || !response.data.presignedUrl) {
        throw new Error(response.data.error || '获取预签名 URL 失败');
      }

      console.log(`✅ [OSS-CredentialManager] 成功获取预签名 URL`);

      return {
        presignedUrl: response.data.presignedUrl,
        publicUrl: response.data.publicUrl || `https://${this.cachedConfig?.endpoint}/${objectKey}`
      };

    } catch (error) {
      console.error('❌ [OSS-CredentialManager] 获取预签名 URL 失败:', error);
      throw error;
    }
  }

  /**
   * 🔄 获取 OSS 配置（带缓存）
   */
  async getConfig(userId?: string): Promise<{ endpoint: string; bucket: string; region: string }> {
    // 检查缓存是否有效（提前 5 分钟认为过期）
    if (this.cachedConfig) {
      const expirationTime = new Date(this.cachedConfig.expiration).getTime();
      if (Date.now() < expirationTime - 5 * 60 * 1000) {
        return {
          endpoint: this.cachedConfig.endpoint,
          bucket: this.cachedConfig.bucket,
          region: this.cachedConfig.region
        };
      }
      console.log('⏰ [OSS-CredentialManager] 缓存配置即将过期，重新获取');
    }

    // 重新获取配置
    return await this.fetchConfig(userId);
  }

  /**
   * 🧹 清除缓存
   */
  clearCache(): void {
    this.cachedConfig = null;
    console.log('🧹 [OSS-CredentialManager] 已清除配置缓存');
  }
}

// 导出单例
export const ossCredentialManager = new OSSCredentialManager();
