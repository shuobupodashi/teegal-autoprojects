import { v4 as uuidv4 } from "uuid";
import { Message, FileAttachment } from "@/components/workspace/types/ChatTypes";

/**
 * 🔥 错误消息翻译表
 * 将后端层层包装的原始错误（如 "Insufficient Balance"）转换为用户友好的中文提示
 * 匹配顺序：从上到下，首个命中即返回
 *
 * 注意：原始错误仍保留在 metadata.originalError 中用于调试
 */
const ERROR_TRANSLATIONS: Array<{ pattern: RegExp; message: string }> = [
  // 余额 / 配额类（最常见，放最前面）
  { pattern: /Insufficient Balance|余额不足/i, message: "模型服务余额不足，请充值后重试" },
  { pattern: /quota.*exceeded|配额.*超限/i, message: "API 配额已超限，请稍后重试或升级套餐" },
  { pattern: /rate.*limit.*exceeded|速率限制|请求过于频繁/i, message: "请求过于频繁，请稍后重试" },
  { pattern: /rate_limit_reached|max.*concurrency|并发.*上限/i, message: "请求达到并发上限，请等待几秒后重试" },

  // 认证 / 权限类
  { pattern: /401.*Unauthorized|认证失败|invalid.*api.*key/i, message: "API 密钥认证失败，请检查凭据配置" },
  { pattern: /403.*Forbidden|权限不足/i, message: "无权限访问该模型，请检查凭据配置" },

  // 模型可用性
  { pattern: /model.*not.*available|模型.*不可用/i, message: "所选模型不可用，请更换模型后重试" },
  { pattern: /not.*found.*the.*model|model.*not.*found|resource_not_found|permission.*denied/i, message: "所选模型不存在或无访问权限，请检查模型名称或更换模型" },

  // 网络 / 超时类
  { pattern: /timeout|超时|ETIMEDOUT/i, message: "请求超时，请检查网络后重试" },
  { pattern: /network|connection.*refused|ECONNREFUSED/i, message: "网络连接异常，请检查网络后重试" },

  // 上下文长度
  { pattern: /context.*length|max.*tokens.*exceeded|上下文.*超长/i, message: "对话上下文过长，请新建对话或清理历史后重试" },
];

/**
 * 🔥 从嵌套 JSON 错误中提取最内层的 message 字段
 * 如 'API调用失败[500]: {"success":false,"error":"...404 {"error":{"message":"Not found the model kimi-k3","type":"..."}}"}'
 * → 'Not found the model kimi-k3 or Permission denied'
 */
function extractInnerMessage(errorContent: string): string | null {
  // 匹配 "message":"xxx" 格式（取最后一个，通常是最内层的）
  const matches = errorContent.matchAll(/"message"\s*:\s*"([^"]+)"/g);
  let lastMatch: string | null = null;
  for (const m of matches) {
    lastMatch = m[1];
  }
  return lastMatch;
}

/**
 * 🔥 将原始错误内容翻译为用户友好的中文提示
 * 1. 命中已知模式 → 返回翻译后的中文
 * 2. 未命中但有 JSON message → 提取真实原因
 * 3. 都没有 → 返回截断后的原始错误
 *
 * 🔥 导出供 SummaryHandler 等调用方复用（模型调用失败的主路径也走这张翻译表）
 */
export function translateError(errorContent: string): string {
  // 1. 命中已知模式
  for (const { pattern, message } of ERROR_TRANSLATIONS) {
    if (pattern.test(errorContent)) {
      return `对不起，调用模型失败了，原因为：${message}`;
    }
  }
  // 2. 从嵌套 JSON 中提取真实原因
  const innerMessage = extractInnerMessage(errorContent);
  if (innerMessage) {
    return `对不起，调用模型失败了，原因为：${innerMessage}`;
  }
  // 3. 截断原始错误（避免过长的 JSON 刷屏）
  const truncated = errorContent.length > 150 ? errorContent.substring(0, 150) + '...' : errorContent;
  return `对不起，调用模型失败了，原因为：${truncated}`;
}

export class MessageFactory {
  /**
   * 创建Auto消息 - 用于auto模式的消息，支持phase_data结构
   */
  static createAutoMessage(
    content: string,
    agentName: string = "Auto助手",
    files: FileAttachment[] = [],
    metadata: any = {},
  ): Message {
    const { phase, phaseKey, phaseText, phaseResult, phase_result, toolName, stepId, stepTitle, ...otherMetadata } =
      metadata;

    // 🔥 构建增强的phase_data结构 - 支持状态累积
    let phaseData = null;
    if (phase && phaseKey) {
      phaseData = {
        phase,
        phaseKey, // 🔥 统一使用phaseKey作为合并标识符
        phases: phaseText ? [{ phaseText, status: metadata.status || "processing", timestamp: Date.now() }] : [],
        // 🔥 新增：当前状态字段，便于快速访问
        currentStatus: metadata.status || "processing",
        // 🔥 根据不同阶段添加特定字段
        ...(phase === "toolsuse" && toolName && { toolName }),
        ...(phase === "executing" && stepId && { stepId }),
        ...(phase === "executing" && stepTitle && { stepTitle }),
        // 🔥 phase_result 支持两种字段名
        ...((phaseResult || phase_result) && { phase_result: phaseResult || phase_result }),
        // 🔥 保持工具使用状态信息
        ...(metadata.toolsUseStatus && { toolsUseStatus: metadata.toolsUseStatus }),
      };
    }

    return {
      id: `auto_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      role: "auto",
      content,
      timestamp: new Date(),
      agentName,
      files,
      metadata: {
        ...otherMetadata,
        autoMode: true,
        agentName,
        // 🔥 保留phase在metadata中便于快速访问
        ...(phase && { phase }),
        // 🔥 保持phaseKey在metadata中，便于前端组件访问
        ...(phaseKey && { phaseKey }),
      },
      ...(phaseData && { phase_data: phaseData }),
    };
  }

  /**
   * 🔥 新增：文件去重和清理功能
   */
  static sanitizeAndDedupeFiles(files: FileAttachment[]): FileAttachment[] {
    if (!files || files.length === 0) return [];

    const seen = new Set();
    const deduped: FileAttachment[] = [];

    files.forEach((file) => {
      // 使用id和content作为去重键
      const key = `${file.id}_${file.content || file.url}`;

      if (!seen.has(key)) {
        seen.add(key);

        // 清理文件对象，移除冗余字段
        const cleanFile: FileAttachment = {
          id: file.id,
          name: file.name,
          type: file.type,
          content: file.content || file.base64 || '',
          url: file.url,
          mimeType: file.mimeType,
          storageUrl: (file as any).storageUrl || undefined,
          isUploaded: (file as any).isUploaded || false,
          uploadTimestamp: (file as any).uploadTimestamp || undefined,
        };

        // 只在必要时保留url字段
        if (file.url && file.url !== file.content) {
          cleanFile.url = file.url;
        }

        // 保留dimensions如果存在
        if (file.dimensions) {
          cleanFile.dimensions = file.dimensions;
        }

        deduped.push(cleanFile);
      }
    });

    console.log("🧹 [MESSAGE-FACTORY] 文件去重清理:", {
      originalCount: files.length,
      dedupedCount: deduped.length,
      removedDuplicates: files.length - deduped.length,
    });

    return deduped;
  }

  static createUserMessage(content: string, files: FileAttachment[] = [], metadata?: Record<string, any>): Message {
    // 🔥 应用文件去重和清理
    const cleanFiles = this.sanitizeAndDedupeFiles(files);

    console.log("🏭 [MESSAGE-FACTORY] 创建用户消息:", {
      contentLength: content.length,
      filesCount: cleanFiles.length,
      hasMetadata: !!metadata,
      metadataKeys: metadata ? Object.keys(metadata) : [],
    });

    return {
      id: uuidv4(),
      role: "user",
      content,
      timestamp: new Date(),
      files: cleanFiles,
      metadata,
    };
  }

  static createAssistantMessage(
    content: string,
    agentName?: string,
    files: FileAttachment[] = [],
    metadata?: Record<string, any>,
  ): Message {
    // 🔥 应用文件去重和清理
    const cleanFiles = this.sanitizeAndDedupeFiles(files);

    console.log("🏭 [MESSAGE-FACTORY] 创建助手消息:", {
      contentLength: content.length,
      filesCount: cleanFiles.length,
      agentName: agentName || "default",
    });

    return {
      id: uuidv4(),
      role: "assistant",
      content,
      timestamp: new Date(),
      files: cleanFiles,
      metadata: {
        ...metadata,
        agentName: agentName || "Assistant",
      },
    };
  }

  static createErrorMessage(title: string, error: any, metadata?: Record<string, any>): Message {
    const errorContent = error instanceof Error ? error.message : String(error);

    console.log("🏭 [MESSAGE-FACTORY] 创建错误消息:", {
      title,
      errorLength: errorContent.length,
    });

    // 🔥 将原始错误翻译为用户友好的中文提示（如 "Insufficient Balance" → "余额不足"）
    const friendlyErrorMessage = translateError(errorContent);

    return {
      id: uuidv4(),
      role: "system",
      content: friendlyErrorMessage,
      timestamp: new Date(),
      metadata: {
        ...metadata,
        isError: true,
        errorType: title,
        // 保留原始错误信息在metadata中用于调试
        originalError: errorContent,
        originalTitle: title,
      },
    };
  }

  // 🔥 恢复：AgentForm消息创建 - 添加去重处理
  static createAgentFormSubmissionMessage(
    agent: any,
    parameters: Record<string, any>,
    files: FileAttachment[] = [],
  ): Message {
    // 🔥 应用文件去重和清理
    const cleanFiles = this.sanitizeAndDedupeFiles(files);

    let content = `【提交需求】Agent: ${agent.name}\n`;

    // 添加文本参数
    if (parameters.textParams) {
      Object.entries(parameters.textParams).forEach(([key, value]) => {
        content += `${key}: ${value}\n`;
      });
    }

    // 添加文件信息
    if (cleanFiles.length > 0) {
      content += `\n📁 已上传文件: ${cleanFiles.length}个\n`;
      cleanFiles.forEach((file) => {
        content += `- ${file.name}\n`;
      });
    }

    return {
      id: uuidv4(),
      role: "user",
      content,
      timestamp: new Date(),
      files: cleanFiles,
      metadata: {
        isAgentFormSubmission: true,
        agentName: agent.name,
        agentFormParameters: parameters,
      },
    };
  }
}
