import { CloudPaymentService } from '../cloud/CloudPaymentService';
import { CloudAuthService } from '../cloud/CloudAuthService';

/**
 * 检查是否在 Electron 环境中
 */
function isElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electron?.isElectron;
}

export interface RechargeOrderData {
  orderId: string;
  orderNo: string;
  paymentUrl: string;
}

export interface RechargeOrder {
  id: string;
  order_no: string;
  amount_yuan: number;
  amount_be: number;
  status: string;
  created_at: string;
  paid_at?: string;
}

/**
 * 支付宝支付服务 - 云端 API 版本
 * 保持接口不变，仅修改内部实现
 */
export class AlipayService {
  /**
   * 获取当前应用的基础URL
   */
  private static getBaseUrl(): string {
    // 在生产环境中使用实际域名，开发环境使用localhost
    if (typeof window !== 'undefined') {
      const { protocol, hostname, port } = window.location;
      // 如果是localhost且端口是3000，说明是开发环境
      if (hostname === 'localhost' && port === '3000') {
        return `${protocol}//${hostname}:${port}`;
      }
      return `${protocol}//${hostname}${port ? ':' + port : ''}`;
    }
    return 'http://localhost:3000'; // 后备方案
  }

  /**
   * 创建充值订单并获取支付链接
   * 注意：云端版本暂未实现完整的支付流程，需要后续添加
   */
  static async createRechargeOrder(amountYuan: number): Promise<RechargeOrderData> {
    try {
      console.log('🔥 [ALIPAY-SERVICE] 创建充值订单:', { amountYuan });

      // 检查用户是否登录
      if (!CloudAuthService.isLoggedIn()) {
        console.error('❌ [ALIPAY-SERVICE] 用户未登录');
        throw new Error('用户未登录');
      }

      const profile = await CloudAuthService.getProfile();
      if (!profile.success || !profile.user) {
        console.error('❌ [ALIPAY-SERVICE] 无法获取用户信息');
        throw new Error('无法获取用户信息');
      }

      console.log('👤 [ALIPAY-SERVICE] 用户已登录:', { userId: profile.user.id });

      // 🔥 调用云端支付 API 创建订单
      console.log('🔥 [ALIPAY-SERVICE] 调用云端创建订单 API');
      const result = await CloudPaymentService.createOrder(amountYuan);

      if (!result.success || !result.orderId || !result.paymentUrl) {
        console.error('❌ [ALIPAY-SERVICE] 云端创建订单失败:', result.error);
        throw new Error(result.error || '创建订单失败');
      }

      console.log('✅ [ALIPAY-SERVICE] 订单创建成功:', {
        orderId: result.orderId,
        orderNo: result.orderNo
      });

      return {
        orderId: result.orderId,
        orderNo: result.orderNo || result.orderId,
        paymentUrl: result.paymentUrl
      };

    } catch (error) {
      console.error('❌ [ALIPAY-SERVICE] 创建充值订单失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户的充值订单列表
   */
  static async getUserRechargeOrders(): Promise<RechargeOrder[]> {
    try {
      const result = await CloudPaymentService.getOrders();
      
      if (!result.success || !result.orders) {
        return [];
      }

      // 转换云端订单格式为本地格式
      return result.orders.map(order => ({
        id: order.id.toString(),
        order_no: order.orderNo,
        amount_yuan: order.amountYuan,
        amount_be: order.amountBe,
        status: order.status,
        created_at: order.createdAt,
        paid_at: order.paidAt,
      }));
    } catch (error) {
      console.error('❌ [ALIPAY-SERVICE] 获取充值订单失败:', error);
      return [];
    }
  }

  /**
   * 展示工具：BE 数量（1元 = 1BE）
   */
  static formatBE(be: number): string {
    return `${be} BE`;
  }

  /**
   * 展示工具：人民币金额
   */
  static formatAmount(yuan: number): string {
    return `¥${yuan.toFixed(2)}`;
  }

  /**
   * 展示工具：订单状态文案/样式（枚举与云端 payment-db 一致：pending/paid/failed/refunded）
   */
  static getStatusText(status: string): string {
    const map: Record<string, string> = {
      pending: '待支付',
      paid: '已支付',
      failed: '支付失败',
      refunded: '已退款',
    };
    return map[status] || status;
  }

  static getStatusColor(status: string): string {
    const map: Record<string, string> = {
      pending: 'text-yellow-600',
      paid: 'text-green-600',
      failed: 'text-red-600',
      refunded: 'text-gray-500',
    };
    return map[status] || 'text-gray-500';
  }

  /**
   * 根据订单ID查询订单状态
   * 注意：云端版本暂未实现
   */
  static async getOrderStatus(orderId: string): Promise<RechargeOrder | null> {
    try {
      // TODO: 从云端获取订单状态
      console.warn('⚠️ [ALIPAY-SERVICE] 云端版本暂未实现 getOrderStatus');
      return null;
    } catch (error) {
      console.error('❌ [ALIPAY-SERVICE] 查询订单状态失败:', error);
      return null;
    }
  }

  /**
   * 跳转到支付链接
   * 在 Electron 中使用系统浏览器打开，在 Web 中使用新窗口打开
   */
  static redirectToPayment(paymentUrl: string): void {
    if (isElectron()) {
      // Electron 环境：使用 electronAPI 打开外部链接
      (window as any).electron?.openExternal?.(paymentUrl);
    } else {
      // Web 环境：使用新窗口打开
      window.open(paymentUrl, '_blank');
    }
  }
}
