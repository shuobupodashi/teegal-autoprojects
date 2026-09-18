export interface StorageUploadResult {
  success: boolean;
  url?: string;
  error?: string;
  path?: string;
}

export interface StorageDeleteResult {
  success: boolean;
  error?: string;
}

/**
 * 统一存储接口
 */
export interface IStorageProvider {
  /**
   * 上传文件
   * 支持File | Blob | string(data:URL)三种格式
   */
  upload(
    bucket: string,
    path: string,
    file: File | Blob | string,
    options?: { 
      contentType?: string;
      upsert?: boolean;
    }
  ): Promise<StorageUploadResult>;

  /**
   * 获取公共访问URL
   */
  getPublicUrl(bucket: string, path: string): string;

  /**
   * 删除文件
   */
  delete(bucket: string, path: string): Promise<StorageDeleteResult>;

  /**
   * 提供商名称
   */
  getProviderName(): string;
}