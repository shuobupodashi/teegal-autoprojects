import { IStorageProvider } from './StorageProvider';
import { AliOSSStorageProvider } from './AliOSSStorageProvider';

export class StorageFactory {
  private static ossProvider: AliOSSStorageProvider;

  /**
   * 获取存储提供商实例
   * @param provider 存储提供商类型，目前仅支持 'oss'
   */
  static getProvider(provider: 'oss' = 'oss'): IStorageProvider {
    switch (provider) {
      case 'oss':
      default:
        if (!this.ossProvider) {
          this.ossProvider = new AliOSSStorageProvider();
        }
        return this.ossProvider;
    }
  }

  /**
   * 根据环境变量或配置获取默认存储提供商
   */
  static getDefaultProvider(): IStorageProvider {
    // 优先使用 OSS，因为国内模型需要国内存储
    const defaultProvider = 'oss';
    return this.getProvider(defaultProvider);
  }
}