/**
 * Check Credits Tool
 * 🔥 用于检查用户在 MC City 的余额和 credits
 * Agent 可以在调用付费应用前检查用户是否有足够余额
 */

import { AutoStep, AutoToolResult } from "../auto/types";

// 🔥 获取 home-web 服务地址
import { CLOUD_BASE_URL } from '@/config/api';
const HOME_WEB_URL = CLOUD_BASE_URL;

// 🔥 获取认证令牌
const getAuthToken = (): string | null => {
  try {
    const token = localStorage.getItem('cloud_access_token');
    return token || null;
  } catch (e) {
    console.error('[MC-CITY] 获取 Token 失败:', e);
  }
  return null;
};

export interface CreditsInfo {
  balance: number;           // 当前余额
  totalEarned: number;       // 累计获得
  totalSpent: number;        // 累计消费
  currency: string;          // 货币类型 (credits)
}

/**
 * 执行余额查询
 */
export const executeCheckCreditsTool = async (
  step: AutoStep,
  planId: string,
  context?: { userId?: string; conversationId?: string }
): Promise<AutoToolResult> => {
  const userId = context?.userId;

  if (!userId) {
    return {
      success: false,
      error: "无法获取用户 ID，无法查询余额",
    };
  }

  console.log(`💰 [CHECK-CREDITS] 查询余额: userId=${userId}`);

  try {
    // 🔥 调用 home-web 服务端余额查询接口
    const token = getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    console.log(`💰 [CHECK-CREDITS] Token: ${token ? '已获取' : '未获取'}, 请求头:`, headers);
    
    const response = await fetch(`${HOME_WEB_URL}/api/mc-city/credits`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`查询余额请求失败 [${response.status}]: ${errorText}`);
    }

    const result = await response.json();

    if (!result.success) {
      return {
        success: false,
        error: result.error || "查询余额失败",
      };
    }

    const credits: CreditsInfo = result.data;

    // 计算预估可调用次数（假设平均每次调用消耗 10 credits）
    const avgCost = 10;
    const estimatedCalls = Math.floor(credits.balance / avgCost);

    return {
      success: true,
      data: {
        type: 'checkCredits',
        balance: credits.balance,
        totalEarned: credits.totalEarned,
        totalSpent: credits.totalSpent,
        currency: credits.currency,
        estimatedCalls: estimatedCalls,
        message: `当前余额: ${credits.balance} credits，预估可调用 ${estimatedCalls} 次`,
        hasEnoughBalance: credits.balance > 0,
      },
    };
  } catch (error) {
    console.error('❌ [CHECK-CREDITS] 查询异常:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "查询余额失败",
    };
  }
};
