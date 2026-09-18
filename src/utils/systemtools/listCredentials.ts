/**
 * List Credentials Tool (list_credentials)
 *
 * 🔥 凭据查询工具：返回用户已配置的凭据列表（仅元数据，不含明文值）
 *
 * 闭环设计：
 * - LLM 通过此工具看到环境变量名（如 OPENAI_API_KEY）和描述
 * - LLM 在调用 userpc_shell 时传入 credentialName=环境变量名
 * - userpc_shell 自动注入为同名环境变量
 * - LLM 始终看不到凭据的明文值
 */

import { AutoStep, AutoToolResult } from '../auto/types';

interface ListCredentialsContext {
  userId: string;
  conversationId: string;
}

/**
 * 🔥 执行 list_credentials 工具
 */
export async function executeListCredentialsTool(
  step: AutoStep,
  _sessionId: string,
  context: ListCredentialsContext
): Promise<AutoToolResult> {
  console.log('🔑 [LIST-CREDENTIALS] 执行凭据查询工具');

  const { userId } = context;

  if (!userId) {
    return {
      success: false,
      error: '未获取到用户信息，无法查询凭据',
      metadata: { toolName: 'list_credentials' },
    };
  }

  try {
    // 🔥 检测 Electron 环境
    const electron = (window as any).electron;
    if (!electron?.localStorage?.listCredentialsMeta) {
      return {
        success: false,
        error: '凭据管理功能仅在桌面端可用',
        metadata: { toolName: 'list_credentials' },
      };
    }

    // 🔥 获取凭据元数据列表（不含明文值）
    const credentials = await electron.localStorage.listCredentialsMeta(userId);

    if (!credentials || credentials.length === 0) {
      return {
        success: true,
        data: {
          type: 'text',
          content: '当前没有任何凭据。请让用户在「凭据管理」中添加凭据（如 SSH 密码、API Key 等）。',
          credentials: [],
        },
        metadata: { toolName: 'list_credentials' },
      };
    }

    // 🔥 格式化列表给 LLM：env 型只暴露名称和描述，param 型额外暴露值
    const lines = credentials.map((cred: any, index: number) => {
      const base = `${index + 1}. ${cred.env_var} | 描述: ${cred.description || '无'}`;
      // param 型对 LLM 透明（返回值），env 型不返回值
      return cred.value !== undefined ? `${base} | 值: ${cred.value}` : base;
    });

    const content = [
      `📋 可用凭据列表（共 ${credentials.length} 个）：`,
      '',
      ...lines,
      '',
      '💡 使用方式：在调用 userpc_shell 时传入 credentialName 参数（值为环境变量名），系统会自动将凭据值注入为同名环境变量。',
      '例如：userpc_shell(query="ssh user@host", credentialName="SSHPASS") → 自动设置 $SSHPASS 环境变量',
    ].join('\n');

    return {
      success: true,
      data: {
        type: 'text',
        content,
        credentials, // 🔥 结构化数据，前端可解析展示
      },
      metadata: { toolName: 'list_credentials' },
    };
  } catch (error: any) {
    console.error('❌ [LIST-CREDENTIALS] 查询凭据失败:', error);
    return {
      success: false,
      error: `查询凭据失败: ${error.message}`,
      metadata: { toolName: 'list_credentials' },
    };
  }
}
