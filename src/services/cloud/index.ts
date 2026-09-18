/**
 * 云端服务统一导出
 * 
 * 这些服务用于与 home-web 后端 API 交互
 * 包括：用户认证、支付、余额查询等功能
 */

export { CloudAuthService } from './CloudAuthService';
export { CloudPaymentService } from './CloudPaymentService';

// 类型导出
export type {
  CloudUser,
  CloudAuthResponse,
  CloudLoginRequest,
  CloudRegisterRequest,
} from './CloudAuthService';

export type {
  CloudRechargeOrder,
  CloudBalanceLog,
  CloudBalanceInfo,
} from './CloudPaymentService';
