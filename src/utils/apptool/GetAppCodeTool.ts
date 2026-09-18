/**
 * Get App Code Tool
 * 🔥 用于在 reaction 循环中获取 Desktop App 的代码
 * 让 LLM 知道如何设计 database
 * 🔥 已迁移到本地存储
 */

import { AutoStep, AutoToolResult } from "../auto/types";
import { desktopAppStorage } from "@/services/storage";

/**
 * 🔥 从 query 文本中提取 appId
 * 支持多种格式：
 * - "appid: xxx" / "appId: xxx"
 * - "appid为：xxx" / "appId为：xxx"
 * - "appid是xxx" / "appId是xxx"
 * - "应用id: xxx" / "应用ID: xxx"
 * - 纯 UUID 格式
 */
function extractAppIdFromQuery(query: string): string | null {
  if (!query || typeof query !== 'string') return null;
  
  // 1. 匹配 "appid: xxx" / "appId: xxx" / "app id: xxx"
  const appIdColonMatch = query.match(/app\s*id[：:]\s*([a-f0-9-]{36})/i);
  if (appIdColonMatch) return appIdColonMatch[1];
  
  // 2. 匹配 "appid为：xxx" / "appId为：xxx" / "appid是xxx"
  const appIdIsMatch = query.match(/app\s*id(?:为|是|等于)[：:\s]*([a-f0-9-]{36})/i);
  if (appIdIsMatch) return appIdIsMatch[1];
  
  // 3. 匹配 "应用id: xxx" / "应用ID: xxx" / "应用 id: xxx"
  const chineseAppIdMatch = query.match(/应用\s*id[：:]\s*([a-f0-9-]{36})/i);
  if (chineseAppIdMatch) return chineseAppIdMatch[1];
  
  // 4. 匹配 "应用为：xxx" / "应用是xxx"
  const chineseAppIsMatch = query.match(/应用(?:为|是|等于)[：:\s]*([a-f0-9-]{36})/i);
  if (chineseAppIsMatch) return chineseAppIsMatch[1];
  
  // 5. 匹配纯 UUID 格式（36位，包含连字符）
  const uuidMatch = query.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (uuidMatch) return uuidMatch[1];
  
  return null;
}

/**
 * 从对象中提取 appId（支持任意 key，只要 value 是 UUID 格式）
 */
function extractAppIdFromParams(params: Record<string, any>): string | null {
  if (!params || typeof params !== 'object') return null;
  
  // 遍历所有参数值，查找 UUID 格式的 appId
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      // 检查是否是 UUID 格式
      const uuidMatch = value.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
      if (uuidMatch) return uuidMatch[1];
    }
  }
  
  return null;
}

/**
 * 从数据库获取应用的代码
 */
export const executeGetAppCodeTool = async (
  step: AutoStep,
  planId: string,
  context?: { userId?: string }
): Promise<AutoToolResult> => {
  // 🔥 支持多种参数传递方式：appId/appid/app_id/projectId/projectid/project_id 或 query（LLM 通常使用 query）
  const params = step.toolParams || step.parameters || {};
  
  // 1. 直接参数传递（支持各种命名风格）
  let appId = step.appId || 
    params?.appId || params?.appid || params?.app_id ||
    params?.projectId || params?.projectid || params?.project_id;
  
  // 2. 从任意参数值中提取 UUID（兜底方案）
  if (!appId) {
    appId = extractAppIdFromParams(params);
  }
  
  // 3. 从 query 中提取 appId
  if (!appId && params?.query) {
    appId = extractAppIdFromQuery(params.query);
  }
  
  const userId = context?.userId;

  // 🔥 检查必要参数
  if (!appId) {
    return {
      success: false,
      error: "缺少 projectId 参数，无法获取项目代码",
    };
  }

  if (!userId) {
    return {
      success: false,
      error: "缺少 userId，无法获取应用代码",
    };
  }

  try {
    console.log(`[GET-APP-CODE-TOOL] 获取应用代码: appId=${appId}, userId=${userId}`);

    // 🔥 从本地存储获取应用详情
    const data = await desktopAppStorage.getById(appId);

    if (!data) {
      return {
        success: false,
        error: `未找到应用: ${appId}`,
      };
    }

    // 验证用户权限
    if (data.user_id !== userId) {
      return {
        success: false,
        error: `无权访问应用: ${appId}`,
      };
    }

    // 🔥 提取代码内容
    const code = data.code || '';
    const codeVersion = data.code_version || 'unknown';
    const appName = data.name || '未命名应用';
    
    // 解析代码文件结构
    const files: Record<string, string> = {};
    if (code) {
      try {
        // 尝试解析 JSON 格式的代码
        const parsed = JSON.parse(code);
        if (typeof parsed === 'object') {
          Object.assign(files, parsed);
        } else {
          files['main.py'] = code;
        }
      } catch {
        // 如果不是 JSON，尝试按文件分割
        // 简单处理：直接作为整体返回
        files['app_code'] = code;
      }
    }

    console.log(`[GET-APP-CODE-TOOL] 获取成功: ${appName}, 代码长度: ${code.length}`);

    return {
      success: true,
      data: {
        type: 'appCode',
        appId,
        appName,
        codeVersion,
        code,
        files,
        fileCount: Object.keys(files).length,
        message: `获取应用 "${appName}" 代码成功，包含 ${Object.keys(files).length} 个文件`,
      },
    };
  } catch (error) {
    console.error('[GET-APP-CODE-TOOL] 异常:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "获取应用代码失败",
    };
  }
};
