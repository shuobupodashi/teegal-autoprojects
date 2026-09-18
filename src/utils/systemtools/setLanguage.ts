/**
 * Teegal Tool: Set Language (teegal_set_language)
 *
 * 功能：修改Teegal软件的语言偏好设置
 * 
 * 参数说明：
 * - language: 'zh' | 'en' - 目标语言代码
 * 
 * 执行流程：
 * 1. 保存语言偏好到本地存储
 * 2. 更新 i18n 语言
 * 3. 如果用户已登录，同步到数据库
 * 4. 返回执行结果
 */

import i18n from '@/i18n/index';
import { toast } from 'sonner';

export interface SetLanguageParams {
  language: 'zh' | 'en';
  userId?: string;
}

export interface SetLanguageResult {
  success: boolean;
  message: string;
  language: 'zh' | 'en';
  error?: string;
}

/**
 * 修改系统语言设置
 */
export async function handleSetLanguage(
  params: SetLanguageParams
): Promise<SetLanguageResult> {
  console.log('🌐 [SET-LANGUAGE-TOOL] 开始执行，参数:', params);
  
  try {
    const { language, userId } = params;

    // 验证语言参数
    if (!['zh', 'en'].includes(language)) {
      console.warn('❌ [SET-LANGUAGE-TOOL] 不支持的语言代码:', language);
      return {
        success: false,
        message: '不支持的语言代码',
        language: 'en',
        error: `Invalid language: ${language}. Supported: zh, en`,
      };
    }

    // 1️⃣ 保存到本地存储
    try {
      console.log('💾 [SET-LANGUAGE-TOOL] 保存到本地存储:', language);
      localStorage.setItem('preferredLanguage', language);
      localStorage.setItem('i18nextLng', language);
      console.log('✅ [SET-LANGUAGE-TOOL] 本地存储保存完成');
    } catch (e) {
      console.warn('⚠️ [SET-LANGUAGE-TOOL] 本地存储设置失败:', e);
      // 继续执行，不中断流程
    }

    // 2️⃣ 更新 i18n（添加超时保护）
    console.log('🔄 [SET-LANGUAGE-TOOL] 更新 i18n 语言...');
    
    // 创建超时 Promise
    const changeLanguageWithTimeout = Promise.race([
      i18n.changeLanguage(language),
      new Promise<void>((_, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('i18n.changeLanguage timeout after 3000ms'));
        }, 3000);
        // 清理 timeout
        void i18n.changeLanguage(language).then(() => clearTimeout(timeout));
      })
    ]);
    
    try {
      await changeLanguageWithTimeout;
      console.log('✅ [SET-LANGUAGE-TOOL] i18n 语言更新完成');
    } catch (timeoutError) {
      console.warn('⚠️ [SET-LANGUAGE-TOOL] i18n 更新超时或失败:', timeoutError);
      // i18n 更新失败不影响整个流程，本地存储已更新
    }

    // 3️⃣ 返回成功结果
    const successMsg =
      language === 'zh' ? '语言已切换为中文' : 'Language changed to English';

    console.log('✅ [SET-LANGUAGE-TOOL] 执行完成，返回成功结果');
    return {
      success: true,
      message: successMsg,
      language,
    };
  } catch (error) {
    console.error('❌ [SET-LANGUAGE-TOOL] 执行异常:', error);

    return {
      success: false,
      message: '语言设置失败',
      language: 'en',
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

interface AutoStep {
  toolParams?: Record<string, any>;
  parameters?: Record<string, any>;
}

interface AutoToolResult {
  success: boolean;
  data?: any;
  error?: string | null;
  metadata?: Record<string, any>;
}

export async function executeSetLanguageTool(
  step: AutoStep,
  _planId: string
): Promise<AutoToolResult> {
  const params = step.toolParams || step.parameters || {};
  const query = params.query || params.language;

  if (!query) {
    return { success: false, data: null, error: '缺少语言参数' };
  }

  const result = await handleSetLanguage({ language: query as 'zh' | 'en' });

  return {
    success: result.success,
    data: {
      language: result.language,
      message: result.message,
    },
    error: result.error || null,
  };
}
