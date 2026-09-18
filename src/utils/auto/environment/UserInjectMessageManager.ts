/**
 * UserInjectMessageManager
 * 管理用户在处理过程中发送的待注入消息
 *
 * 职责：
 * 1. 临时存储用户在 isProcessing 状态下发送的消息
 * 2. 在 EnvironmentBuilder 构建时注入到 environmentText
 * 3. 消费后自动清理
 */

export interface UserInjectMessage {
  id: string;
  content: string;
  timestamp: number;
  files?: Array<{
    id: string;
    name: string;
    type: string;
  }>;
}

class UserInjectMessageManagerClass {
  private userInjectMessages: Map<string, UserInjectMessage[]> = new Map();

  /**
   * 添加用户注入消息
   * @param conversationId 会话ID
   * @param content 消息内容
   * @param files 关联文件
   * @returns 消息ID
   */
  addMessage(
    conversationId: string,
    content: string,
    files?: UserInjectMessage['files']
  ): string {
    const messageId = `user_inject_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const message: UserInjectMessage = {
      id: messageId,
      content,
      timestamp: Date.now(),
      files,
    };

    const existing = this.userInjectMessages.get(conversationId) || [];
    existing.push(message);
    this.userInjectMessages.set(conversationId, existing);

    console.log(`[USER-INJECT-MESSAGE] 添加用户注入消息:`, {
      conversationId,
      messageId,
      contentLength: content.length,
      totalInjectMessages: existing.length,
    });

    return messageId;
  }

  /**
   * 获取并消费用户注入消息（获取后清除）
   * @param conversationId 会话ID
   * @returns 用户注入消息列表
   */
  consumeMessages(conversationId: string): UserInjectMessage[] {
    const messages = this.userInjectMessages.get(conversationId) || [];

    if (messages.length > 0) {
      this.userInjectMessages.delete(conversationId);
      console.log(`[USER-INJECT-MESSAGE] 消费用户注入消息:`, {
        conversationId,
        count: messages.length,
      });
    }

    return messages;
  }

  /**
   * 查看用户注入消息（不清除）
   * @param conversationId 会话ID
   * @returns 用户注入消息列表
   */
  peekMessages(conversationId: string): UserInjectMessage[] {
    return this.userInjectMessages.get(conversationId) || [];
  }

  /**
   * 是否有用户注入消息
   * @param conversationId 会话ID
   * @returns 是否有用户注入消息
   */
  hasInjectMessages(conversationId: string): boolean {
    const messages = this.userInjectMessages.get(conversationId);
    return !!messages && messages.length > 0;
  }

  /**
   * 清除指定会话的用户注入消息
   * @param conversationId 会话ID
   */
  clearMessages(conversationId: string): void {
    this.userInjectMessages.delete(conversationId);
    console.log(`[USER-INJECT-MESSAGE] 清除用户注入消息:`, { conversationId });
  }

  /**
   * 获取所有会话的用户注入消息统计
   */
  getStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.userInjectMessages.forEach((messages, conversationId) => {
      stats[conversationId] = messages.length;
    });
    return stats;
  }
}

// 单例实例
export const UserInjectMessageManager = new UserInjectMessageManagerClass();
