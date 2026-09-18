/**
 * Execution Log 存储服务
 * 统一的本地代码执行记录存储接口，仅支持本地 SQLite
 */

// 获取 Electron localStorage API
const getElectronLocalStorage = () => {
  return (window as any).electron?.localStorage;
};

// 本地存储 DAO（通过 IPC 调用后端）
const localExecutionLogDAO = {
  async create(log: any) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      console.warn('[ExecutionLogStorage] Electron localStorage API 不可用');
      return null;
    }
    try {
      return await localStorage.createExecutionLog(log);
    } catch (error) {
      console.error('[ExecutionLogStorage] createExecutionLog error:', error);
      return null;
    }
  },

  async getByAppId(appId: string) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      return [];
    }
    try {
      const result = await localStorage.getExecutionLogsByAppId(appId);
      return result || [];
    } catch (error) {
      console.error('[ExecutionLogStorage] getExecutionLogsByAppId error:', error);
      return [];
    }
  },

  async getSummaryByAppId(appId: string) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      return [];
    }
    try {
      return await localStorage.getExecutionLogSummariesByAppId(appId);
    } catch (error) {
      console.error('[ExecutionLogStorage] getSummaryByAppId error:', error);
      return [];
    }
  },

  async getById(id: string) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      return null;
    }
    try {
      return await localStorage.getExecutionLogById(id);
    } catch (error) {
      console.error('[ExecutionLogStorage] getExecutionLogById error:', error);
      return null;
    }
  },

  async update(id: string, updates: any) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      return null;
    }
    try {
      return await localStorage.updateExecutionLog(id, updates);
    } catch (error) {
      console.error('[ExecutionLogStorage] updateExecutionLog error:', error);
      return null;
    }
  },

  async delete(id: string) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      return false;
    }
    try {
      return await localStorage.deleteExecutionLog(id);
    } catch (error) {
      console.error('[ExecutionLogStorage] deleteExecutionLog error:', error);
      return false;
    }
  }
};

/**
 * Execution Log 存储服务
 * 仅支持本地存储
 */
export const executionLogStorage = {
  async create(log: any) {
    return await localExecutionLogDAO.create(log);
  },

  async getByAppId(appId: string) {
    return await localExecutionLogDAO.getByAppId(appId);
  },

  async getSummaryByAppId(appId: string) {
    return await localExecutionLogDAO.getSummaryByAppId(appId);
  },

  async getById(id: string) {
    return await localExecutionLogDAO.getById(id);
  },

  async update(id: string, updates: any) {
    return await localExecutionLogDAO.update(id, updates);
  },

  async delete(id: string) {
    return await localExecutionLogDAO.delete(id);
  }
};
