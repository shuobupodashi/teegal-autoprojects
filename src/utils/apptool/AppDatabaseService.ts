/**
 * AppDatabaseService
 * 应用元数据的数据库 CRUD 封装
 * 注意：这是一个普通服务类，不能调用React Hooks
 *
 * 职责：
 * - 仅负责 desktopAppStorage 的元数据 CRUD 封装（create / get / update）
 * - 代码文件读写完全由 FileTree/utils.ts 走 Electron IPC 负责
 * - 不触碰文件系统，只跟数据库打交道
 */

import { desktopAppStorage } from '@/services/storage';
import { DesktopApp, CodeVersion } from '@/components/workspace/DesktopModule/types/DesktopAppTypes';
import { mapDbAppToDesktopApp } from '@/utils/workspace/desktopAppUtils';
import { v4 as uuidv4 } from 'uuid';

interface AppDatabaseService {
  getDesktopApp: (appId: string, userId: string) => Promise<DesktopApp | null>;
  createDesktopApp: (appData: Omit<DesktopApp, 'id' | 'userId' | 'createdAt' | 'updatedAt'>, userId: string) => Promise<DesktopApp | null>;
  updateDesktopApp: (appId: string, updates: Partial<DesktopApp>, userId: string) => Promise<DesktopApp | null>;
}

export const appDatabaseService: AppDatabaseService = {
  async getDesktopApp(appId: string, userId: string): Promise<DesktopApp | null> {
    try {
      const data = await desktopAppStorage.getById(appId);
      if (!data || data.user_id !== userId) return null;

      // 🔥 仅返回数据库元数据；代码内容由 FileTree 单独读取
      return mapDbAppToDesktopApp(data);
    } catch (error) {
      console.error('Error fetching desktop app:', error);
      return null;
    }
  },

  async createDesktopApp(appData: Omit<DesktopApp, 'id' | 'userId' | 'createdAt' | 'updatedAt'>, userId: string): Promise<DesktopApp | null> {
    try {
      const newApp = {
        id: uuidv4(), // 🔥 生成唯一 ID
        name: appData.name,
        description: appData.description,
        current_code: appData.current_code || (typeof appData.code === 'string' ? appData.code : (appData.code as any)?.content) || '',
        code: appData.current_code || (typeof appData.code === 'string' ? appData.code : (appData.code as any)?.content) || '',
        config: appData.config,
        env_vars: appData.env_vars,
        preview: appData.preview,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const data = await desktopAppStorage.create(newApp);
      if (!data) return null;

      // 映射返回的数据
      return mapDbAppToDesktopApp(data);
    } catch (error) {
      console.error('Error creating desktop app:', error);
      return null;
    }
  },

  async updateDesktopApp(appId: string, updates: Partial<DesktopApp>, userId: string): Promise<DesktopApp | null> {
    try {
      // 先获取当前应用
      const currentApp = await desktopAppStorage.getById(appId);
      if (!currentApp || currentApp.user_id !== userId) return null;

      // 映射更新数据到数据库字段
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;

      // 🔥 代码保存完全由 FileTree.saveFile 负责（走 Electron IPC + history 备份）
      // 这里只同步更新数据库元数据缓存字段
      if (updates.code !== undefined || updates.current_code !== undefined) {
        const newCode = updates.current_code || (typeof updates.code === 'string' ? updates.code : (updates.code as any)?.content);
        if (newCode) {
          dbUpdates.current_code = newCode;
          dbUpdates.code = newCode;
        }
        if (updates.code_version) {
          dbUpdates.code_version = updates.code_version;
        }
      }

      if (updates.config !== undefined) dbUpdates.config = updates.config;
      if (updates.env_vars !== undefined) dbUpdates.env_vars = updates.env_vars;
      if (updates.preview !== undefined) dbUpdates.preview = updates.preview;

      const data = await desktopAppStorage.update(appId, dbUpdates);
      if (!data) return null;

      return this.getDesktopApp(appId, userId);
    } catch (error) {
      console.error('Error updating desktop app:', error);
      return null;
    }
  },
};
