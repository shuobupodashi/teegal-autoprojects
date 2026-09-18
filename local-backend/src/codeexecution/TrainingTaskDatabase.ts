
import { trainingTaskDAO } from '../local-storage/dao';

/**
 * 🚀 GPU 训练任务持久化服务
 * 专门处理 GPU 任务的状态记录与幂等控制
 * 🔥 已迁移到本地 SQLite 存储
 */
export const trainingTaskDatabase = {
  /**
   * 获取任务状态
   */
  async getTask(id: string) {
    try {
      const data = trainingTaskDAO.getById(id);
      return data;
    } catch (error) {
      console.error('❌ [DATABASE] 查询任务失败:', error);
      return null;
    }
  },

  /**
   * 获取正在运行或等待中的任务
   */
  async getActiveTasks() {
    try {
      return trainingTaskDAO.getByStatus(['running', 'pending']);
    } catch (error) {
      console.error('❌ [DATABASE] 查询活跃任务失败:', error);
      return [];
    }
  },

  /**
   * 创建任务（支持幂等，如果 ID 已存在则更新）
   */
  async createTask(task: any) {
    try {
      // 检查任务是否已存在
      const existingTask = trainingTaskDAO.getById(task.id);
      if (existingTask) {
        // 已存在则更新
        trainingTaskDAO.update(task.id, task);
      } else {
        // 不存在则创建
        trainingTaskDAO.create(task);
      }
    } catch (error) {
      console.error('❌ [DATABASE] 创建任务失败:', error);
      throw error;
    }
  },

  /**
   * 更新任务结果
   */
  async updateTask(id: string, updates: any) {
    try {
      trainingTaskDAO.update(id, updates);
    } catch (error) {
      console.error('❌ [DATABASE] 更新任务失败:', error);
    }
  }
};
