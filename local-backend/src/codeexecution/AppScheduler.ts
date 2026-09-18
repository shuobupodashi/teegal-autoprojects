import { WebSocketManager } from '../websocket';

/**
 * 🔥 WebSocket 管理器持有者
 * 职责：为 GPUExecutor 提供 WebSocket 推送能力
 * 
 * 🔥 注意：自动运行调度功能已移除，CPU 任务由前端直接执行
 */
export class AppScheduler {
  private static instance: AppScheduler;
  private wsManager: WebSocketManager | null = null;

  private constructor() {}

  static getInstance(): AppScheduler {
    if (!AppScheduler.instance) {
      AppScheduler.instance = new AppScheduler();
    }
    return AppScheduler.instance;
  }

  /**
   * 注入 WebSocket 管理器以支持实时推送
   */
  setWsManager(wsManager: WebSocketManager) {
    this.wsManager = wsManager;
  }

  /**
   * 获取 WebSocket 管理器
   */
  getWsManager(): WebSocketManager | null {
    return this.wsManager;
  }

  /**
   * 🔥 已废弃：自动运行调度功能已移除
   * CPU 任务现在由前端直接执行
   */
  schedule(): void {
    console.log('⚠️ [AppScheduler] 自动运行功能已移除，CPU 任务请在前端执行');
  }

  /**
   * 🔥 已废弃：自动运行调度功能已移除
   */
  unschedule(): void {
    // 无操作
  }

  /**
   * 🔥 已废弃：自动运行调度功能已移除
   */
  isScheduled(): boolean {
    return false;
  }
}
