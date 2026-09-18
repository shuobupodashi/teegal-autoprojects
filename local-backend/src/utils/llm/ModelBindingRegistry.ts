/**
 * 模型绑定注册表（多用户版本）
 *
 * 每个用户有独立的配置目录：
 * .teegal/user-{hash(userId)}/model-bindings.json
 *
 * 使用哈希值作为目录名，避免特殊字符问题，同时保护用户隐私
 *
 * 管理用户自定义模型与用途点的绑定关系
 */

import * as fs from 'fs';
import { resolveAppDataDir } from '../appDataDir';
import * as path from 'path';
import * as crypto from 'crypto';

const MODEL_BINDINGS_FILENAME = 'model-bindings.json';

// 用户 ID 到哈希的映射缓存（内存中）
const userIdToHashMap: Map<string, string> = new Map();
const hashToUserIdMap: Map<string, string> = new Map();

export interface ModelBindingConfig {
  version: string;
  lastUpdated: string;
  bindings: Record<string, string | null>;
}

// 用户数据缓存
interface UserBindingData {
  bindings: Map<string, string>;
  configPath: string;
  initialized: boolean;
  lastModified?: number;  // 文件最后修改时间
}

// 计算用户 ID 的哈希值（用于目录名）
function getUserIdHash(userId: string): string {
  // 确保 userId 是字符串
  const userIdStr = String(userId);
  
  // 检查缓存
  if (userIdToHashMap.has(userIdStr)) {
    return userIdToHashMap.get(userIdStr)!;
  }

  // 计算 SHA-256 哈希，取前 16 位
  const hash = crypto.createHash('sha256').update(userIdStr).digest('hex').substring(0, 16);

  // 保存映射关系
  userIdToHashMap.set(userIdStr, hash);
  hashToUserIdMap.set(hash, userIdStr);

  return hash;
}

// 获取用户数据目录
function getUserDataDir(userId: string): string {
  if (!userId) {
    throw new Error('[MODEL-BINDING-REGISTRY] userId 不能为空');
  }
  const baseDir = resolveAppDataDir();
  const userHash = getUserIdHash(userId);
  return path.join(baseDir, `user-${userHash}`);
}

// 获取用户绑定配置文件路径
function getUserBindingsFilePath(userId: string): string {
  if (!userId) {
    throw new Error('[MODEL-BINDING-REGISTRY] userId 不能为空');
  }
  return path.join(getUserDataDir(userId), MODEL_BINDINGS_FILENAME);
}

export class ModelBindingRegistry {
  private static instance: ModelBindingRegistry;
  private userDataMap: Map<string, UserBindingData> = new Map();
  private currentUserId: string | null = null;

  static getInstance(): ModelBindingRegistry {
    if (!ModelBindingRegistry.instance) {
      ModelBindingRegistry.instance = new ModelBindingRegistry();
    }
    return ModelBindingRegistry.instance;
  }

  // 获取或创建用户数据
  private getUserData(userId: string): UserBindingData {
    if (!this.userDataMap.has(userId)) {
      this.userDataMap.set(userId, {
        bindings: new Map(),
        configPath: getUserBindingsFilePath(userId),
        initialized: false,
        lastModified: 0,
      });
    }
    return this.userDataMap.get(userId)!;
  }

  /**
   * 🔥 检查文件是否被修改，如果被修改则重新加载
   */
  private checkAndReloadIfNeeded(userId: string): void {
    const userData = this.getUserData(userId);
    if (!fs.existsSync(userData.configPath)) {
      return;
    }
    
    const stats = fs.statSync(userData.configPath);
    const currentModified = stats.mtimeMs;
    
    // 如果文件被修改过，重新加载
    if (userData.lastModified && currentModified > userData.lastModified) {
      console.log(`[MODEL-BINDING-REGISTRY] 检测到配置文件已修改，重新加载: ${userData.configPath}`);
      userData.initialized = false;
      userData.bindings.clear();
      this.initialize(userId);
    }
  }

  // 设置当前用户（切换用户时调用）
  setCurrentUser(userId: string): void {
    if (!userId) {
      console.warn('[MODEL-BINDING-REGISTRY] 拒绝切换到空用户');
      return;
    }
    // 🔥 如果切换到不同用户，重新加载配置（支持外部修改文件后刷新）
    if (this.currentUserId !== userId) {
      this.currentUserId = userId;
      this.reload(userId);
    } else {
      this.currentUserId = userId;
      this.initialize(this.currentUserId);
    }
  }

  // 获取当前用户ID
  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  initialize(userId: string = this.currentUserId || ''): void {
    if (!userId) {
      console.warn('[MODEL-BINDING-REGISTRY] 初始化失败: userId 为空');
      return;
    }
    const userData = this.getUserData(userId);

    if (userData.initialized) {
      return;
    }

    try {
      const dir = path.dirname(userData.configPath);
      if (!fs.existsSync(dir)) {
        console.log(`[MODEL-BINDING-REGISTRY] 创建目录: ${dir}`);
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(userData.configPath)) {
        const content = fs.readFileSync(userData.configPath, 'utf-8');
        const config: ModelBindingConfig = JSON.parse(content);

        if (config.version && config.version === '1.0') {
          Object.entries(config.bindings).forEach(([key, modelId]) => {
            if (modelId) {
              userData.bindings.set(key, modelId);
            }
          });
          console.log(`[MODEL-BINDING-REGISTRY] 用户 ${userId}: 已加载 ${userData.bindings.size} 个绑定关系`);
          
          // 🔥 检查并补充缺失的系统默认绑定
          const defaultBindings = this.getDefaultBindings();
          let hasNewBindings = false;
          Object.entries(defaultBindings).forEach(([key, modelId]) => {
            if (!userData.bindings.has(key)) {
              userData.bindings.set(key, modelId);
              hasNewBindings = true;
              console.log(`[MODEL-BINDING-REGISTRY] 用户 ${userId}: 补充默认绑定 ${key} -> ${modelId}`);
            }
          });
          
          // 如果有新增绑定，保存到文件
          if (hasNewBindings) {
            this.saveToFile(userId);
            console.log(`[MODEL-BINDING-REGISTRY] 用户 ${userId}: 已补充默认绑定并保存`);
          }
        } else {
          console.warn(`[MODEL-BINDING-REGISTRY] 用户 ${userId}: 配置文件版本不兼容: ${config.version}`);
        }
      } else {
        console.log(`[MODEL-BINDING-REGISTRY] 用户 ${userId}: 绑定配置文件不存在，创建默认绑定配置`);
        // 🔥 创建系统默认绑定（视觉和语音识别）
        const defaultBindings = this.getDefaultBindings();
        Object.entries(defaultBindings).forEach(([key, modelId]) => {
          userData.bindings.set(key, modelId);
        });
        this.saveToFile(userId);
        console.log(`[MODEL-BINDING-REGISTRY] 用户 ${userId}: 已创建 ${userData.bindings.size} 个默认绑定关系`);
      }

      userData.initialized = true;
      // 记录文件修改时间
      if (fs.existsSync(userData.configPath)) {
        userData.lastModified = fs.statSync(userData.configPath).mtimeMs;
      }
    } catch (error) {
      console.error(`[MODEL-BINDING-REGISTRY] 用户 ${userId}: 初始化失败:`, error);
      userData.initialized = true;
    }
  }

  getBinding(key: string, userId: string = this.currentUserId || ''): string | undefined {
    if (!userId) {
      console.warn('[MODEL-BINDING-REGISTRY] 获取绑定失败: userId 为空');
      return undefined;
    }
    this.checkAndReloadIfNeeded(userId);  // 🔥 检查文件是否被修改
    this.initialize(userId);
    const userData = this.getUserData(userId);
    return userData.bindings.get(key);
  }

  getAllBindings(userId: string = this.currentUserId || ''): Record<string, string> {
    if (!userId) {
      console.warn('[MODEL-BINDING-REGISTRY] 获取所有绑定失败: userId 为空');
      return {};
    }
    this.checkAndReloadIfNeeded(userId);  // 🔥 检查文件是否被修改
    this.initialize(userId);
    const userData = this.getUserData(userId);
    const result: Record<string, string> = {};
    userData.bindings.forEach((modelId, key) => {
      result[key] = modelId;
    });
    return result;
  }

  private getDefaultBindings(): Record<string, string> {
    // 🔥 系统默认绑定：视觉和语音识别模型
    // 这些绑定是固定的，用户只需要配置对应的 API key
    return {
      'assistant.vision': 'system-vision',
      'assistant.speech_recognition': 'system-speech',
    };
  }

  setBinding(key: string, modelId: string | null, userId: string = this.currentUserId || ''): boolean {
    if (!userId) {
      console.warn('[MODEL-BINDING-REGISTRY] 设置绑定失败: userId 为空');
      return false;
    }
    this.initialize(userId);
    const userData = this.getUserData(userId);

    if (modelId === null) {
      userData.bindings.delete(key);
      console.log(`[MODEL-BINDING-REGISTRY] 用户 ${userId}: 已移除绑定: ${key}`);
    } else {
      userData.bindings.set(key, modelId);
      console.log(`[MODEL-BINDING-REGISTRY] 用户 ${userId}: 已设置绑定: ${key} -> ${modelId}`);
    }

    return this.saveToFile(userId);
  }

  setMultipleBindings(bindings: Record<string, string | null>, userId: string = this.currentUserId || ''): boolean {
    if (!userId) {
      console.warn('[MODEL-BINDING-REGISTRY] 批量设置绑定失败: userId 为空');
      return false;
    }
    this.initialize(userId);
    const userData = this.getUserData(userId);

    Object.entries(bindings).forEach(([key, modelId]) => {
      if (modelId) {
        userData.bindings.set(key, modelId);
      } else {
        userData.bindings.delete(key);
      }
    });

    return this.saveToFile(userId);
  }

  private saveToFile(userId: string = this.currentUserId || ''): boolean {
    if (!userId) {
      console.warn('[MODEL-BINDING-REGISTRY] 保存文件失败: userId 为空');
      return false;
    }
    try {
      const userData = this.getUserData(userId);
      const config: ModelBindingConfig = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        bindings: Object.fromEntries(userData.bindings)
      };

      const dir = path.dirname(userData.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(userData.configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log(`[MODEL-BINDING-REGISTRY] 用户 ${userId}: 绑定配置已保存`);
      return true;
    } catch (error) {
      console.error(`[MODEL-BINDING-REGISTRY] 用户 ${userId}: 保存失败:`, error);
      return false;
    }
  }

  /**
   * 🔥 重新加载用户的绑定配置（用于外部修改文件后刷新）
   * @param userId 用户ID，默认为当前用户
   */
  reload(userId: string = this.currentUserId || ''): void {
    if (!userId) {
      console.warn('[MODEL-BINDING-REGISTRY] 重新加载失败: userId 为空');
      return;
    }
    const userData = this.getUserData(userId);
    userData.initialized = false;
    userData.bindings.clear();
    this.initialize(userId);
    console.log(`[MODEL-BINDING-REGISTRY] 用户 ${userId}: 绑定配置已重新加载`);
  }
}

export const modelBindingRegistry = ModelBindingRegistry.getInstance();
