/**
 * 存储模式管理
 * 控制使用本地存储还是在线存储
 */

export type StorageMode = 'local' | 'online';

class StorageModeManager {
  // 🔧 配置：修改此处切换存储模式 ('local' | 'online')
  private mode: StorageMode = 'local';

  /**
   * 获取当前存储模式
   */
  getMode(): StorageMode {
    return this.mode;
  }

  /**
   * 设置存储模式
   */
  setMode(mode: StorageMode): void {
    console.log(`[StorageMode] 切换存储模式: ${this.mode} -> ${mode}`);
    this.mode = mode;
    // 持久化到 localStorage
    localStorage.setItem('workbees-storage-mode', mode);
  }

  /**
   * 初始化存储模式
   * 从 localStorage 读取已保存的模式，如果没有则使用默认值
   */
  init(): void {
    const savedMode = localStorage.getItem('workbees-storage-mode') as StorageMode | null;
    if (savedMode && (savedMode === 'local' || savedMode === 'online')) {
      this.mode = savedMode;
    }
    console.log(`[StorageMode] 使用配置模式: ${this.mode}`);
  }

  /**
   * 是否使用本地存储
   */
  isLocal(): boolean {
    return this.mode === 'local';
  }

  /**
   * 是否使用在线存储
   */
  isOnline(): boolean {
    return this.mode === 'online';
  }

  /**
   * 获取当前模式的中文描述
   */
  getModeDescription(): string {
    const descriptions: Record<StorageMode, string> = {
      local: '本地存储（SQLite）',
      online: '在线存储（云端）'
    };
    return descriptions[this.mode];
  }
}

export const storageMode = new StorageModeManager();
