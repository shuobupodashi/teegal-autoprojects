import { executionTraceStore, ExecutionTrace } from "./ExecutionTraceStore";

interface PendingRequest {
  sessionId: string;
  resolve: (reply: string | null) => void;
  timeout: NodeJS.Timeout;
}

type AgentMessageHandler = (
  sessionId: string,
  agentMessage: string
) => Promise<void>;

/**
 * 🔥 Agent 通信服务
 * 
 * 职责：
 * 1. Tool 发送消息并等待 SummaryHandler 回复
 * 2. Tool 发送通知消息（不等待回复）
 * 3. 通过 SummaryHandler 共享 session 上下文
 * 4. 支持超时机制
 * 5. 提供执行轨迹查询接口
 */
class AgentCommunicationService {
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private agentMessageHandler: AgentMessageHandler | null = null;

  /**
   * 🔥 设置 Agent 消息处理器（由 SummaryHandler 调用）
   */
  setAgentMessageHandler(handler: AgentMessageHandler): void {
    this.agentMessageHandler = handler;
  }

  /**
   * 🔥 发送通知消息（不等待回复）
   * 
   * 用于：进度通知、日志记录等不需要回复的场景
   * 就像 console.log 一样，发送完就继续执行
   * 
   * @param sessionId Session ID
   * @param message 消息内容
   */
  async send(sessionId: string, message: string): Promise<void> {
    console.log('[AGENT-COMMUNICATION] 发送通知消息:', { sessionId, message: message.substring(0, 50) });

    if (!this.agentMessageHandler) {
      console.warn('[AGENT-COMMUNICATION] 未设置 agentMessageHandler，通知消息被忽略');
      return;
    }

    // 🔥 触发消息处理，但不等待回复
    this.agentMessageHandler(sessionId, message).catch(error => {
      console.error('[AGENT-COMMUNICATION] 通知消息处理失败:', error);
    });
  }

  /**
   * 🔥 发送消息并等待回复
   * 
   * 用于：需要授权、需要决策等必须等待回复的场景
   * 
   * @param sessionId Session ID
   * @param message 消息内容
   * @param timeout 超时时间（毫秒），默认 60 秒
   * @returns checkResult 的回复，或 null（超时）
   */
  async sendAndWaitForReply(
    sessionId: string,
    message: string,
    timeout: number = 60000
  ): Promise<string | null> {
    console.log('[AGENT-COMMUNICATION] 发送消息并等待回复:', { sessionId, message: message.substring(0, 50) });

    return new Promise(async (resolve) => {
      // 1. 存储等待请求
      const pendingRequest: PendingRequest = {
        sessionId,
        resolve,
        timeout: setTimeout(() => {
          console.log('[AGENT-COMMUNICATION] 等待回复超时:', sessionId);
          this.pendingRequests.delete(sessionId);
          resolve(null);
        }, timeout),
      };
      this.pendingRequests.set(sessionId, pendingRequest);

      // 2. 触发 checkResult
      try {
        await this.triggerCheckResult(sessionId, message);
      } catch (error) {
        console.error('[AGENT-COMMUNICATION] 触发 checkResult 失败:', error);
        clearTimeout(pendingRequest.timeout);
        this.pendingRequests.delete(sessionId);
        resolve(null);
      }
    });
  }

  /**
   * 🔥 查询执行轨迹
   * 
   * 用于：SummaryHandler 查询 session 的执行过程
   * 
   * @param filter 过滤条件
   * @returns 轨迹列表
   */
  queryTraces(filter?: {
    sessionId?: string;
    toolName?: string;
    type?: ExecutionTrace['type'];
    limit?: number;
  }): ExecutionTrace[] {
    return executionTraceStore.queryTraces(filter);
  }

  /**
   * 🔥 获取 session 执行摘要
   * 
   * 用于：SummaryHandler 快速了解 session 执行过程
   * 
   * @param sessionId Session ID
   * @returns 执行摘要文本
   */
  getSessionSummary(sessionId: string): string {
    return executionTraceStore.getSessionSummary(sessionId);
  }

  /**
   * 🔥 触发消息处理（调用 SummaryHandler）
   * 
   * 🔥 修复：不再根据 agentMessageHandler 的返回值来 resolve
   * agentMessageHandler 只负责触发 SummaryHandler 处理消息
   * 回复将通过 handleReply 异步发送
   */
  private async triggerCheckResult(sessionId: string, agentMessage: string): Promise<void> {
    if (!this.agentMessageHandler) {
      console.warn('[AGENT-COMMUNICATION] 未设置 agentMessageHandler');
      const pendingRequest = this.pendingRequests.get(sessionId);
      if (pendingRequest) {
        clearTimeout(pendingRequest.timeout);
        this.pendingRequests.delete(sessionId);
        pendingRequest.resolve(null);
      }
      return;
    }

    console.log('[AGENT-COMMUNICATION] 触发消息处理:', sessionId);

    try {
      // 🔥 只触发消息处理，不等待返回值
      // 回复将通过 handleReply 异步发送
      await this.agentMessageHandler(sessionId, agentMessage);
      console.log('[AGENT-COMMUNICATION] 消息处理已触发，等待 handleReply');
    } catch (error) {
      console.error('[AGENT-COMMUNICATION] 消息处理执行失败:', error);
      // 🔥 异常时 resolve(null)，避免调用者一直等待
      const pendingRequest = this.pendingRequests.get(sessionId);
      if (pendingRequest) {
        clearTimeout(pendingRequest.timeout);
        this.pendingRequests.delete(sessionId);
        pendingRequest.resolve(null);
      }
    }
  }

  /**
   * 🔥 处理回复
   */
  handleReply(sessionId: string, reply: string): void {
    const pendingRequest = this.pendingRequests.get(sessionId);
    if (pendingRequest) {
      clearTimeout(pendingRequest.timeout);
      this.pendingRequests.delete(sessionId);
      pendingRequest.resolve(reply);
    }
  }

  /**
   * 🔥 清理指定 session 的所有状态
   */
  clearSession(sessionId: string): void {
    const pendingRequest = this.pendingRequests.get(sessionId);
    if (pendingRequest) {
      clearTimeout(pendingRequest.timeout);
      this.pendingRequests.delete(sessionId);
    }
    // 🔥 同时清理轨迹
    executionTraceStore.clearSession(sessionId);
  }
}

export const agentCommunicationService = new AgentCommunicationService();
