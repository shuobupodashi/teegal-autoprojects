/**
 * Message 存储服务
 * 统一的消息存储接口，底层支持本地 SQLite
 */


import { storageMode } from './StorageMode';

// 获取 Electron localStorage API
const getElectronLocalStorage = () => {
  return (window as any).electron?.localStorage;
};

// 本地存储 DAO（通过 IPC 调用后端）
const localMessageDAO = {
  async create(message: any) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      console.warn('[MessageStorage] Electron localStorage API 不可用');
      return null;
    }
    try {
      const result = await localStorage.createMessage(message);
      return result;
    } catch (error) {
      console.error('[localMessageDAO] createMessage 失败:', error);
      throw error;
    }
  },

  async createBatch(messages: any[]) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      return [];
    }
    return await localStorage.createBatchMessages(messages);
  },

  async getByConversationId(conversationId: string, limit = 100, offset = 0) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      console.warn('[localMessageDAO] Electron localStorage API 不可用');
      return [];
    }
    try {
      const result = await localStorage.getMessagesByConversationId(conversationId, limit, offset);
      return result;
    } catch (error) {
      console.error('[localMessageDAO] getByConversationId error:', error);
      return [];
    }
  },

  async getCount(conversationId: string) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      console.warn('[localMessageDAO] Electron localStorage API 不可用');
      return 0;
    }
    try {
      const result = await localStorage.getMessageCount(conversationId);
      return result || 0;
    } catch (error) {
      console.error('[localMessageDAO] getCount error:', error);
      return 0;
    }
  },

  async updateByCallId(conversationId: string, callId: string, updates: any) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      console.warn('[localMessageDAO] Electron localStorage API 不可用');
      return false;
    }
    // 🔥 检查方法是否存在（需要重启 Electron 才能加载新 preload 脚本）
    if (!localStorage.updateMessageByCallId) {
      console.warn('[localMessageDAO] updateMessageByCallId 方法不存在，请重启 Electron 应用');
      return false;
    }
    try {
      const result = await localStorage.updateMessageByCallId({ conversationId, callId, updates });
      return result || false;
    } catch (error) {
      console.error('[localMessageDAO] updateByCallId error:', error);
      return false;
    }
  },

  async getSessionMessages(conversationId: string, sessionId: string) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      console.warn('[localMessageDAO] Electron localStorage API 不可用');
      return [];
    }
    if (!localStorage.getSessionMessages) {
      console.error('[localMessageDAO] getSessionMessages 方法不存在，请重启 Electron 应用');
      return [];
    }
    try {
      const result = await localStorage.getSessionMessages(conversationId, sessionId);
      return result || [];
    } catch (error) {
      console.error('[localMessageDAO] getSessionMessages error:', error);
      return [];
    }
  }
};

/**
 * Message 存储服务
 * 只支持本地 SQLite 存储
 */
export const messageStorage = {
  /**
   * 创建消息
   */
  async create(message: any) {
    return localMessageDAO.create(message);
  },

  /**
   * 批量创建消息
   */
  async createBatch(messages: any[]) {
    return localMessageDAO.createBatch(messages);
  },

  /**
   * 获取对话的消息列表
   */
  async getByConversationId(conversationId: string, limit = 100, offset = 0) {
    return localMessageDAO.getByConversationId(conversationId, limit, offset);
  },

  /**
   * 获取对话的消息总数
   */
  async getCount(conversationId: string) {
    return localMessageDAO.getCount(conversationId);
  },

  /**
   * 🔥 通过 callId 更新消息
   */
  async updateByCallId(conversationId: string, callId: string, updates: any) {
    return localMessageDAO.updateByCallId(conversationId, callId, updates);
  },

  async getSessionMessages(conversationId: string, sessionId: string) {
    return localMessageDAO.getSessionMessages(conversationId, sessionId);
  }
};
