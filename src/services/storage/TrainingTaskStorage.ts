/**
 * Training Task 存储服务
 * 统一的训练任务存储接口，仅支持本地 SQLite
 */

// 获取 Electron localStorage API
const getElectronLocalStorage = () => {
  return (window as any).electron?.localStorage;
};

// 本地存储 DAO（通过 IPC 调用后端）
const localTrainingTaskDAO = {
  async create(task: any) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      console.warn('[TrainingTaskStorage] Electron localStorage API 不可用');
      return null;
    }
    try {
      return await localStorage.createTrainingTask(task);
    } catch (error) {
      console.error('[TrainingTaskStorage] createTrainingTask error:', error);
      return null;
    }
  },

  async getByUserId(userId: string, limit = 100, offset = 0) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      return [];
    }
    try {
      const result = await localStorage.getTrainingTasksByUserId(userId, limit, offset);
      return result || [];
    } catch (error) {
      console.error('[TrainingTaskStorage] getTrainingTasksByUserId error:', error);
      return [];
    }
  },

  async getByAppId(appId: string) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      return [];
    }
    try {
      const result = await localStorage.getTrainingTasksByAppId(appId);
      return result || [];
    } catch (error) {
      console.error('[TrainingTaskStorage] getTrainingTasksByAppId error:', error);
      return [];
    }
  },

  async getById(id: string) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      return null;
    }
    try {
      return await localStorage.getTrainingTaskById(id);
    } catch (error) {
      console.error('[TrainingTaskStorage] getTrainingTaskById error:', error);
      return null;
    }
  },

  async update(id: string, updates: any) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      return null;
    }
    try {
      return await localStorage.updateTrainingTask(id, updates);
    } catch (error) {
      console.error('[TrainingTaskStorage] updateTrainingTask error:', error);
      return null;
    }
  },

  async delete(id: string) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      return false;
    }
    try {
      return await localStorage.deleteTrainingTask(id);
    } catch (error) {
      console.error('[TrainingTaskStorage] deleteTrainingTask error:', error);
      return false;
    }
  }
};

/**
 * Training Task 存储服务
 * 仅支持本地存储
 */
export const trainingTaskStorage = {
  /**
   * 创建新训练任务
   */
  async create(task: any) {
    return await localTrainingTaskDAO.create(task);
  },

  /**
   * 获取用户的所有训练任务
   */
  async getByUserId(userId: string, limit = 100, offset = 0) {
    return await localTrainingTaskDAO.getByUserId(userId, limit, offset);
  },

  /**
   * 获取应用的所有训练任务
   */
  async getByAppId(appId: string) {
    return await localTrainingTaskDAO.getByAppId(appId);
  },

  /**
   * 🔥 轻量级查询：只返回摘要，不包含大字段
   * 用于列表展示和定时轮询
   */
  async getSummaryByAppId(appId: string) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      return [];
    }
    try {
      return await localStorage.getTrainingTaskSummariesByAppId(appId);
    } catch (error) {
      console.error('[TrainingTaskStorage] getSummaryByAppId error:', error);
      return [];
    }
  },

  /**
   * 根据 ID 获取训练任务
   */
  async getById(id: string) {
    return await localTrainingTaskDAO.getById(id);
  },

  /**
   * 更新训练任务
   */
  async update(id: string, updates: any) {
    return await localTrainingTaskDAO.update(id, updates);
  },

  /**
   * 删除训练任务
   */
  async delete(id: string) {
    return await localTrainingTaskDAO.delete(id);
  }
};
