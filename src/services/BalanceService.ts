import { CloudPaymentService } from './cloud/CloudPaymentService';
import { CloudAuthService } from './cloud/CloudAuthService';

export interface BalanceInfo {
  balance: number;
  canAfford: boolean;
  requiredAmount: number;
}

export interface DeductionResult {
  success: boolean;
  newBalance?: number;
  error?: string;
}

/**
 * 余额服务 - 云端 API 版本
 * 保持接口不变，仅修改内部实现
 */
export class BalanceService {
  /**
   * 获取用户总余额
   */
  static async getBalance(userId: string): Promise<number> {
    try {
      const result = await CloudPaymentService.getBalance();
      if (result.success) {
        // 返回总余额（付费余额 + 免费余额）
        return (result.balance || 0) + (result.freeBalance || 0);
      }
      return 0;
    } catch (error) {
      console.error('获取用户余额失败:', error);
      return 0;
    }
  }

  /**
   * 检查用户余额是否足够支付指定金额
   */
  static async checkBalance(userId: string, requiredAmount: number): Promise<BalanceInfo> {
    try {
      const result = await CloudPaymentService.checkBalance(requiredAmount);
      
      if (result.success) {
        return {
          balance: result.balance || 0,
          canAfford: result.canAfford || false,
          requiredAmount
        };
      }
      
      return {
        balance: 0,
        canAfford: false,
        requiredAmount
      };
    } catch (error) {
      console.error('检查余额失败:', error);
      return {
        balance: 0,
        canAfford: false,
        requiredAmount
      };
    }
  }

  /**
   * 为Agent使用扣除余额
   */
  static async deductForAgent(
    userId: string, 
    agentId: string, 
    amount: number
  ): Promise<DeductionResult> {
    try {
      console.log('🔥 [BALANCE] 开始扣除Agent使用费用:', {
        userId: userId.substring(0, 8) + '...',
        agentId: agentId.substring(0, 8) + '...',
        amount
      });

      // 1. 检查余额是否充足
      const balanceInfo = await this.checkBalance(userId, amount);
      if (!balanceInfo.canAfford) {
        return {
          success: false,
          error: `余额不足！需要 ${this.formatBE(amount)}，当前余额 ${this.formatBE(balanceInfo.balance)}`
        };
      }

      // 2. 扣除余额（调用云端 API）
      const result = await CloudPaymentService.deductBalance(amount, `使用Agent付费: ${agentId}`);
      
      if (!result.success) {
        console.error('扣除余额失败:', result.error);
        return {
          success: false,
          error: result.error || '扣除余额失败，请重试'
        };
      }

      console.log('✅ [BALANCE] Agent使用费用扣除成功');
      return {
        success: true,
        newBalance: result.newBalance
      };
    } catch (error) {
      console.error('扣除Agent使用费用失败:', error);
      return {
        success: false,
        error: '扣除失败，请重试'
      };
    }
  }

  /**
   * 为Agent失败退还费用
   */
  static async refundForAgent(
    userId: string, 
    agentId: string, 
    amount: number
  ): Promise<boolean> {
    try {
      console.log('🔄 [BALANCE] 开始退还Agent使用费用:', {
        userId: userId.substring(0, 8) + '...',
        agentId: agentId.substring(0, 8) + '...',
        amount
      });

      // 调用云端 API 进行退款
      const result = await CloudPaymentService.deductBalance(-amount, `Agent执行失败，自动退款: ${agentId}`);
      
      if (!result.success) {
        console.error('❌ [BALANCE] 退款失败:', result.error);
        return false;
      }

      console.log('✅ [BALANCE] Agent使用费用退还成功');
      return true;
    } catch (error) {
      console.error('❌ [BALANCE] 退还Agent使用费用异常:', error);
      return false;
    }
  }

  /**
   * 获取Agent价格
   * 注意：云端版本暂时返回0，需要从云端获取
   */
  static async getAgentPrice(agentId: string): Promise<number> {
    try {
      // TODO: 从云端获取Agent价格
      // 目前先返回0，后续可以添加云端API
      console.warn('⚠️ 云端版本暂未实现 getAgentPrice，返回0');
      return 0;
    } catch (error) {
      console.error('获取Agent价格失败:', error);
      return 0;
    }
  }

  /**
   * 增加用户余额（充值等）
   */
  static async addBalance(
    userId: string,
    amount: number,
    type: string = 'recharge',
    referenceId?: string,
    description?: string
  ): Promise<DeductionResult> {
    try {
      console.log('💰 [BALANCE] 开始增加用户余额:', {
        userId: userId.substring(0, 8) + '...',
        amount,
        type
      });

      // 调用云端 API 增加余额（负数扣除相当于增加）
      const result = await CloudPaymentService.deductBalance(-amount, description || `${type}增加余额`);
      
      if (!result.success) {
        console.error('增加余额失败:', result.error);
        return {
          success: false,
          error: result.error || '增加余额失败，请重试'
        };
      }

      console.log('✅ [BALANCE] 用户余额增加成功，新余额:', result.newBalance);
      return {
        success: true,
        newBalance: result.newBalance
      };
    } catch (error) {
      console.error('增加用户余额失败:', error);
      return {
        success: false,
        error: '增加余额失败，请重试'
      };
    }
  }

  /**
   * 格式化BE币显示
   */
  static formatBE(amount: number): string {
    return `${amount} BE`;
  }

  /**
   * 格式化人民币显示（1BE = 1元）
   */
  static formatCurrency(beAmount: number): string {
    const yuan = beAmount.toFixed(2);
    return `¥${yuan}`;
  }
}
