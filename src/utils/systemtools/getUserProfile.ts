/**
 * Teegal Tool: Get Account Info (teegal_get_account_info)
 *
 * 功能：获取当前登录 Teegal 平台的账户信息 + 积分余额
 * 合并了原 check_user_credits 的功能，一次调用返回完整账户画像
 * 包括：账户ID、注册邮箱、昵称、积分余额、预估可调用次数等
 */

import { executeCheckCreditsTool } from '@/utils/apptool/CheckCreditsTool';
import { AutoStep } from '@/utils/auto/types';

export interface AccountInfo {
  accountId: string;
  email?: string;
  nickname?: string;
  avatar?: string;
}

export interface GetAccountInfoResult {
  success: boolean;
  accountInfo?: AccountInfo;
  error?: string;
}

/**
 * 🔥 获取当前账户信息
 * 从 localStorage 读取 CloudAuthService 存储的用户信息
 */
export async function handleGetAccountInfo(): Promise<GetAccountInfoResult> {
  try {
    // 从 localStorage 读取 CloudAuthService 存储的用户信息
    const storedUser = localStorage.getItem('teegal-user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        return {
          success: true,
          accountInfo: {
            accountId: user.id?.toString() || '',
            email: user.email,
            nickname: user.name || user.email?.split("@")[0],
            avatar: user.avatar_url,
          }
        };
      } catch (e) {
        console.error('[GET-ACCOUNT-INFO] 解析账户信息失败:', e);
      }
    }

    return {
      success: false,
      error: '无法获取账户信息，请确保已登录 Teegal 平台'
    };
  } catch (error) {
    console.error('[GET-ACCOUNT-INFO] 获取账户信息失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取账户信息失败'
    };
  }
}

/**
 * 🔥 合并版：账户信息 + 积分余额一次返回
 * 积分查询失败不影响账户信息返回（降级为 credits: null）
 */
export async function executeGetAccountInfoTool(
  _step: AutoStep,
  _planId: string,
  context?: { userId?: string; conversationId?: string }
): Promise<any> {
  const result = await handleGetAccountInfo();

  // 🔥 同时查余额（失败时 credits 为 null，不影响主流程）
  let credits: any = null;
  if (result.success && context?.userId) {
    try {
      const creditsResult = await executeCheckCreditsTool(_step, _planId, {
        userId: context.userId,
        conversationId: context.conversationId,
      });
      if (creditsResult.success && creditsResult.data) {
        credits = {
          balance: creditsResult.data.balance,
          totalEarned: creditsResult.data.totalEarned,
          totalSpent: creditsResult.data.totalSpent,
          currency: creditsResult.data.currency,
          estimatedCalls: creditsResult.data.estimatedCalls,
          hasEnoughBalance: creditsResult.data.hasEnoughBalance,
        };
      }
    } catch (e) {
      console.warn('[GET-ACCOUNT-INFO] 积分查询失败，降级为 null:', e);
    }
  }

  return {
    success: result.success,
    data: {
      accountInfo: result.accountInfo,
      credits,
    },
    error: result.error || null,
  };
}
