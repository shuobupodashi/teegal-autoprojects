/**
 * 统一的中断管理器
 * 使用 AbortController 实现真正的异步操作中断
 */

export class AbortManager {
  private abortController: AbortController | null = null;
  private isAborted: boolean = false;
  private conversationId: string = "";

  /**
   * 开始新的执行，创建新的 AbortController
   */
  start(conversationId: string): AbortSignal {
    this.abortController = new AbortController();
    this.isAborted = false;
    this.conversationId = conversationId;
    console.log(`🚀 [ABORT-MANAGER] 开始执行: ${conversationId}`);
    return this.abortController.signal;
  }

  /**
   * 中断执行
   */
  abort(conversationId?: string): boolean {
    // 如果提供了 conversationId，检查是否匹配
    if (conversationId && this.conversationId !== conversationId) {
      console.log(`⚠️ [ABORT-MANAGER] conversationId 不匹配，忽略中断请求`, {
        requested: conversationId,
        current: this.conversationId
      });
      return false;
    }

    if (this.isAborted) {
      console.log(`⚠️ [ABORT-MANAGER] 已经中断，忽略重复请求`);
      return false;
    }

    console.log(`🛑 [ABORT-MANAGER] 中断执行: ${this.conversationId}`);
    this.isAborted = true;
    this.abortController?.abort();
    return true;
  }

  /**
   * 获取 AbortSignal 用于传递给 fetch
   */
  getSignal(): AbortSignal | undefined {
    return this.abortController?.signal;
  }

  /**
   * 检查是否已中断
   */
  checkAborted(): boolean {
    return this.isAborted;
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.abortController = null;
    this.isAborted = false;
    this.conversationId = "";
  }

  /**
   * 检查 signal 是否已触发中断
   */
  isSignalAborted(): boolean {
    return this.abortController?.signal.aborted ?? false;
  }
}

/**
 * 全局中断管理器实例
 */
export const globalAbortManager = new AbortManager();
