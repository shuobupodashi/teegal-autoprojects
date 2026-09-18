/**
 * ChatMessageItem 类型定义
 * 
 * 基于新的消息结构，支持 apiRole、iconText、content、result 等字段
 */

export type ApiRole = 'summarizer' | 'reactor';
export type MessageStatus = 'pending' | 'streaming' | 'completed' | 'failed';
export type MessageRole = 'user' | 'assistant' | 'system' | 'auto';

/**
 * 消息附件
 */
export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  content?: string;
}

/**
 * 消息数据接口
 * 与后端 Message 结构对应
 */
export interface MessageData {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date | number;
  files?: FileAttachment[];
  metadata?: Record<string, any>;
  
  // 🔥 API 调用角色
  apiRole?: ApiRole;
  
  // 🔥 执行结果
  result?: string;
  
  // 🔥 消息状态
  status?: MessageStatus;
  
  // 🔥 关联的 API 调用 ID
  callId?: string;
  
  iconText?: string;

  sessionId?: string;
  
  memory?: string;
}

/**
 * 图标配置
 */
export interface IconConfig {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  label: string;
}

/**
 * ChatMessageItem 组件属性
 */
export interface ChatMessageItemProps {
  message: MessageData;
  isStreaming?: boolean;
  onRetry?: () => void;
  onCancel?: () => void;
}
