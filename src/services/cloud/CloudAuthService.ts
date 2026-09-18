/**
 * 云端认证服务
 * 用于与 home-web 后端的认证 API 交互
 */

import { CLOUD_API_BASE_URL } from '@/config/api';

// 云端认证 API URL
const CLOUD_API_URL = CLOUD_API_BASE_URL;

export interface CloudUser {
  id: number;
  email: string;
  name: string;
  avatar_url?: string;
  phone?: string;
  is_member: boolean;
  is_admin: boolean;
  member_until?: string;
  usage_count: number;
  usage_limit: number;
  free_usage_count: number;
  be_balance: number;
  be_free: number;
  last_free_claim_date?: string;
  preferred_language: string;
  llm_models: Record<string, any>;
  discount_rate?: number;
  created_at: string;
}

export interface CloudAuthResponse {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  user?: CloudUser;
  error?: string;
}

export interface CloudLoginRequest {
  email: string;
  password: string;
}

export interface CloudRegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export class CloudAuthService {
  // 🔥 并发刷新保护：多个请求同时 401 时，只刷新一次
  private static refreshPromise: Promise<boolean> | null = null;

  private static getHeaders(token?: string): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * 🔥 统一云端请求函数
   * - 自动附加 Authorization header
   * - 401 时自动刷新 token 并重试原请求
   * - 并发刷新保护（多个请求同时 401 只刷新一次）
   *
   * 所有需要认证的云端 API 请求都应通过此函数发送
   */
  static async cloudRequest(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = true
  ): Promise<Response> {
    const url = `${CLOUD_API_URL}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (requireAuth) {
      const token = localStorage.getItem('cloud_access_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    let response = await fetch(url, { ...options, headers });

    // 🔥 401 自动刷新 token 并重试
    if (response.status === 401 && requireAuth) {
      console.log('🔄 [CloudAuth] 收到 401，自动刷新 token...');
      const refreshed = await this.ensureRefreshed();
      if (refreshed) {
        // 刷新成功，用新 token 重试原请求
        const newToken = localStorage.getItem('cloud_access_token');
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
        }
        console.log('✅ [CloudAuth] token 刷新成功，重试原请求');
        response = await fetch(url, { ...options, headers });
      } else {
        console.log('❌ [CloudAuth] token 刷新失败，需要重新登录');
      }
    }

    return response;
  }

  /**
   * 🔥 确保 token 已刷新（并发保护）
   * 多个请求同时 401 时，只刷新一次，其他请求复用同一个 Promise
   */
  private static async ensureRefreshed(): Promise<boolean> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshToken()
        .then((result) => {
          return result.success;
        })
        .finally(() => {
          this.refreshPromise = null;
        });
    }
    return this.refreshPromise;
  }

  /**
   * 用户登录
   */
  static async login(credentials: CloudLoginRequest): Promise<CloudAuthResponse> {
    try {
      const response = await fetch(`${CLOUD_API_URL}/auth/login`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(credentials),
      });

      const data = await response.json();
      
      if (data.success && data.accessToken) {
        // 保存 token 到本地存储
        localStorage.setItem('cloud_access_token', data.accessToken);
        localStorage.setItem('cloud_refresh_token', data.refreshToken);
        // 🔥 保存用户信息
        if (data.user) {
          localStorage.setItem('teegal-user', JSON.stringify(data.user));
        }
        // 🔥 广播登录态变化：数据集购买状态等依赖 JWT 的列表需要刷新
        window.dispatchEvent(new CustomEvent('cloud-auth-changed'));
      }

      return data;
    } catch (error) {
      console.error('云端登录失败:', error);
      return { success: false, error: '网络错误，请稍后重试' };
    }
  }

  /**
   * 用户注册
   */
  static async register(userData: CloudRegisterRequest): Promise<CloudAuthResponse> {
    try {
      const response = await fetch(`${CLOUD_API_URL}/auth/register`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(userData),
      });

      const data = await response.json();
      
      if (data.success && data.accessToken) {
        localStorage.setItem('cloud_access_token', data.accessToken);
        localStorage.setItem('cloud_refresh_token', data.refreshToken);
        // 🔥 保存用户信息
        if (data.user) {
          localStorage.setItem('teegal-user', JSON.stringify(data.user));
        }
      }

      return data;
    } catch (error) {
      console.error('云端注册失败:', error);
      return { success: false, error: '网络错误，请稍后重试' };
    }
  }

  /**
   * 刷新访问令牌
   */
  static async refreshToken(): Promise<CloudAuthResponse> {
    const refreshToken = localStorage.getItem('cloud_refresh_token');
    if (!refreshToken) {
      return { success: false, error: '未找到刷新令牌' };
    }

    try {
      const response = await fetch(`${CLOUD_API_URL}/auth/refresh`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();
      
      if (data.success && data.accessToken) {
        localStorage.setItem('cloud_access_token', data.accessToken);
        localStorage.setItem('cloud_refresh_token', data.refreshToken);
      }

      return data;
    } catch (error) {
      console.error('刷新令牌失败:', error);
      return { success: false, error: '网络错误，请稍后重试' };
    }
  }

  /**
   * 获取当前用户信息
   */
  static async getProfile(): Promise<{ success: boolean; user?: CloudUser; error?: string }> {
    const token = localStorage.getItem('cloud_access_token');
    if (!token) {
      return { success: false, error: '未登录' };
    }

    try {
      const response = await this.cloudRequest('/auth/profile', {
        method: 'GET',
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return { success: false, error: '网络错误，请稍后重试' };
    }
  }

  /**
   * 退出登录
   */
  static logout(): void {
    localStorage.removeItem('cloud_access_token');
    localStorage.removeItem('cloud_refresh_token');
    localStorage.removeItem('teegal-user');
    // 🔥 广播登录态变化：数据集购买状态等依赖 JWT 的列表需要刷新
    window.dispatchEvent(new CustomEvent('cloud-auth-changed'));
  }

  /**
   * 获取当前访问令牌
   */
  static getAccessToken(): string | null {
    return localStorage.getItem('cloud_access_token');
  }

  /**
   * 检查是否已登录
   */
  static isLoggedIn(): boolean {
    return !!localStorage.getItem('cloud_access_token');
  }

  // ==================== OTP 验证码功能 ====================

  /**
   * 发送 OTP 验证码
   */
  static async sendOtp(email: string, name: string, type: 'register' | 'reset_password' = 'register'): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await fetch(`${CLOUD_API_URL}/auth/send-otp`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ email, name, type }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('发送验证码失败:', error);
      return { success: false, error: '网络错误，请稍后重试' };
    }
  }

  /**
   * 验证 OTP 验证码
   */
  static async verifyOtp(email: string, code: string, type: 'register' | 'reset_password' = 'register'): Promise<{ success: boolean; verified?: boolean; message?: string; error?: string }> {
    try {
      const response = await fetch(`${CLOUD_API_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ email, code, type }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('验证验证码失败:', error);
      return { success: false, error: '网络错误，请稍后重试' };
    }
  }

  // ==================== 重置密码功能 ====================

  /**
   * 重置密码
   */
  static async resetPassword(email: string, newPassword: string, code?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await fetch(`${CLOUD_API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ email, newPassword, code }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('重置密码失败:', error);
      return { success: false, error: '网络错误，请稍后重试' };
    }
  }

  /**
   * 验证重置密码验证码
   */
  static async verifyResetCode(email: string, code: string): Promise<{ success: boolean; verified?: boolean; message?: string; error?: string }> {
    try {
      const response = await fetch(`${CLOUD_API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ email, code, mode: 'verify' }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('验证重置密码验证码失败:', error);
      return { success: false, error: '网络错误，请稍后重试' };
    }
  }
}
