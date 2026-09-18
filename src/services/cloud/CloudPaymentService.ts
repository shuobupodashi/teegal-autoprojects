/**
 * 云端支付服务
 * 直接调用 home-web 后端的支付 API
 * home-web 是真正的云端服务端
 */

import { CloudAuthService } from './CloudAuthService';

import { CLOUD_API_BASE_URL } from '@/config/api';
const CLOUD_API_URL = CLOUD_API_BASE_URL;

export interface CloudRechargeOrder {
  id: number;
  orderNo: string;
  amountYuan: number;
  amountBe: number;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  createdAt: string;
  paidAt?: string;
}

export interface CloudBalanceLog {
  id: number;
  type: 'recharge' | 'consumption' | 'refund' | 'bonus';
  amount: number;
  balanceAfter: number;
  description?: string;
  createdAt: string;
}

export interface CloudBalanceInfo {
  balance: number;
  freeBalance: number;
}

export class CloudPaymentService {
  private static getHeaders(): HeadersInit {
    const token = CloudAuthService.getAccessToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * 获取用户余额
   */
  static async getBalance(): Promise<{ success: boolean; balance?: number; freeBalance?: number; error?: string }> {
    try {
      const response = await CloudAuthService.cloudRequest('/balance', {
        method: 'GET',
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取云端余额失败:', error);
      return { success: false, error: '网络错误，请稍后重试' };
    }
  }

  /**
   * 获取充值订单列表
   */
  static async getOrders(): Promise<{ success: boolean; orders?: CloudRechargeOrder[]; error?: string }> {
    try {
      const response = await CloudAuthService.cloudRequest('/payment/orders', {
        method: 'GET',
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取云端订单失败:', error);
      return { success: false, error: '网络错误，请稍后重试' };
    }
  }

  /**
   * 获取余额流水
   */
  static async getLogs(): Promise<{ success: boolean; logs?: CloudBalanceLog[]; error?: string }> {
    try {
      const response = await CloudAuthService.cloudRequest('/balance/logs', {
        method: 'GET',
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取云端流水失败:', error);
      return { success: false, error: '网络错误，请稍后重试' };
    }
  }

  /**
   * 创建充值订单
   */
  static async createOrder(amountYuan: number): Promise<{ success: boolean; orderId?: string; orderNo?: string; paymentUrl?: string; error?: string }> {
    try {
      console.log('🔥 [CLOUD-PAYMENT] 创建订单请求:', { amountYuan });

      const response = await CloudAuthService.cloudRequest('/payment/create-order', {
        method: 'POST',
        body: JSON.stringify({ amountYuan }),
      });

      console.log('🔥 [CLOUD-PAYMENT] 响应状态:', response.status);

      if (!response.ok) {
        const text = await response.text();
        console.error('❌ [CLOUD-PAYMENT] 响应错误:', response.status, text.substring(0, 200));
        return { success: false, error: `服务器错误: ${response.status}` };
      }

      const data = await response.json();
      console.log('✅ [CLOUD-PAYMENT] 创建订单成功:', data);
      return data;
    } catch (error) {
      console.error('❌ [CLOUD-PAYMENT] 创建订单失败:', error);
      return { success: false, error: '网络错误，请稍后重试' };
    }
  }

  /**
   * 检查余额是否足够
   */
  static async checkBalance(requiredAmount: number): Promise<{ success: boolean; canAfford?: boolean; balance?: number; error?: string }> {
    const result = await this.getBalance();
    
    if (!result.success) {
      return result;
    }

    const totalBalance = (result.balance || 0) + (result.freeBalance || 0);
    return {
      success: true,
      canAfford: totalBalance >= requiredAmount,
      balance: totalBalance,
    };
  }

  /**
   * 扣除余额（用于消费）
   * 注意：这是一个本地模拟方法，实际扣费应该在后端完成
   */
  static async deductBalance(amount: number, description?: string): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    // 实际项目中，这里应该调用后端 API 进行扣费
    // 目前先返回成功，实际扣费逻辑在服务端实现
    console.log('扣除余额:', { amount, description });
    
    const balanceResult = await this.getBalance();
    if (!balanceResult.success) {
      return { success: false, error: balanceResult.error };
    }

    const currentBalance = (balanceResult.balance || 0) + (balanceResult.freeBalance || 0);
    if (currentBalance < amount) {
      return { success: false, error: '余额不足' };
    }

    // 返回预估的新余额（实际扣费后余额以服务端为准）
    return {
      success: true,
      newBalance: currentBalance - amount,
    };
  }
}
