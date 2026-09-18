/**
 * Desktop App 存储服务
 * 统一的桌面应用存储接口，仅支持本地 SQLite
 */

// 获取 Electron localStorage API
const getElectronLocalStorage = () => {
  return (window as any).electron?.localStorage;
};

// 本地存储 DAO（通过 IPC 调用后端）
const localDesktopAppDAO = {
  async create(app: any) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      console.warn('[DesktopAppStorage] Electron localStorage API 不可用');
      return null;
    }
    try {
      return await localStorage.createDesktopApp(app);
    } catch (error) {
      console.error('[DesktopAppStorage] createDesktopApp error:', error);
      return null;
    }
  },

  async getByUserId(userId: string, limit = 100, offset = 0, appType?: 'normal' | 'system_base', baseFirst?: boolean) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      return [];
    }
    try {
      const result = await localStorage.getDesktopAppsByUserId(userId, limit, offset, appType, baseFirst);
      return result || [];
    } catch (error) {
      console.error('[DesktopAppStorage] getDesktopAppsByUserId error:', error);
      return [];
    }
  },

  async getById(id: string) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      return null;
    }
    try {
      return await localStorage.getDesktopAppById(id);
    } catch (error) {
      console.error('[DesktopAppStorage] getDesktopAppById error:', error);
      return null;
    }
  },

  async update(id: string, updates: any) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      return null;
    }
    try {
      return await localStorage.updateDesktopApp(id, updates);
    } catch (error) {
      console.error('[DesktopAppStorage] updateDesktopApp error:', error);
      return null;
    }
  },

  async delete(id: string) {
    const localStorage = getElectronLocalStorage();
    if (!localStorage) {
      return false;
    }
    try {
      return await localStorage.deleteDesktopApp(id);
    } catch (error) {
      console.error('[DesktopAppStorage] deleteDesktopApp error:', error);
      return false;
    }
  }
};

/**
 * Desktop App 存储服务
 * 仅支持本地存储
 */
export const desktopAppStorage = {
  /**
   * 创建新应用
   */
  async create(app: any) {
    return await localDesktopAppDAO.create(app);
  },

  /**
   * 获取用户的所有应用
   * @param appType 可选类型过滤（UI 筛选）：normal=普通项目，system_base=基础项目
   * @param baseFirst 基础项目置顶（仅供 LLM 的 list_projects，防项目太多被淹没）
   */
  async getByUserId(userId: string, limit = 100, offset = 0, appType?: 'normal' | 'system_base', baseFirst?: boolean) {
    return await localDesktopAppDAO.getByUserId(userId, limit, offset, appType, baseFirst);
  },

  /**
   * 根据 ID 获取应用
   */
  async getById(id: string) {
    return await localDesktopAppDAO.getById(id);
  },

  /**
   * 更新应用
   */
  async update(id: string, updates: any) {
    return await localDesktopAppDAO.update(id, updates);
  },

  /**
   * 删除应用
   */
  async delete(id: string) {
    return await localDesktopAppDAO.delete(id);
  }
};
