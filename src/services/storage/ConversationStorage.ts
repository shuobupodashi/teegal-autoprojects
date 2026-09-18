/**
 * Conversation 存储服务
 * 统一的对话存储接口，仅支持本地 SQLite
 */

// 获取 Electron localStorage API
const getElectronLocalStorage = () => {
  return (window as any).electron?.localStorage;
};

// 🔥 动态获取后端 URL（从统一配置导入）
import { getBackendUrl } from '@/config/env';

// 🔥 等待后端启动完成
async function waitForBackend(): Promise<boolean> {
  const maxAttempts = 30; // 最多等待 15 秒
  const delay = 500; // 每次等待 500ms

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000), // 2秒超时
      });

      if (response.ok) {
        return true;
      }
    } catch (error) {
      // 忽略错误，继续等待
    }

    await new Promise(resolve => setTimeout(resolve, delay));
  }

  return false;
}

// 本地存储 DAO（通过 IPC 调用后端）
const localConversationDAO = {
  async create(conversation: any) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      console.warn('[ConversationStorage] Electron localStorage API 不可用');
      return null;
    }
    return await localStorage.createConversation(conversation);
  },

  async getByUserId(userId: string, limit = 50, offset = 0) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      console.warn('[ConversationStorage] Electron localStorage API 不可用');
      return [];
    }

    // 🔥 等待后端启动完成
    await waitForBackend();

    return await localStorage.getConversationsByUserId(userId, limit, offset);
  },

  async getById(id: string) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      return null;
    }
    return await localStorage.getConversationById(id);
  },

  async update(id: string, updates: any) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      return false;
    }
    return await localStorage.updateConversation(id, updates);
  },

  async delete(id: string) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      return false;
    }
    return await localStorage.deleteConversation(id);
  }
};

/**
 * Conversation 存储服务
 * 仅支持本地存储
 */
export const conversationStorage = {
  /**
   * 创建对话
   */
  async create(conversation: any) {
    return localConversationDAO.create(conversation);
  },

  /**
   * 获取用户的对话列表
   */
  async getByUserId(userId: string, limit = 50, offset = 0) {
    return localConversationDAO.getByUserId(userId, limit, offset);
  },

  /**
   * 根据 ID 获取对话
   */
  async getById(id: string) {
    return localConversationDAO.getById(id);
  },

  /**
   * 更新对话
   */
  async update(id: string, updates: any) {
    return localConversationDAO.update(id, updates);
  },

  /**
   * 删除对话（软删除）
   */
  async delete(id: string) {
    return localConversationDAO.delete(id);
  }
};
