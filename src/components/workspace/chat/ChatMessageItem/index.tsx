import React from 'react';
import { cn } from '@/lib/utils';
import { MessageIcon } from './MessageIcon';
import { MessageContent } from './MessageContent';
import { ChatMessageItemProps } from './types';

/**
 * ChatMessageItem 组件
 *
 * 基于新的消息结构，支持 apiRole、iconText、content、result 等字段
 *
 * 布局：
 * - icon + iconText 在顶部（显示 API 角色和状态）
 * - content 在中（主要消息内容）
 * - result 在后（执行结果，可折叠）
 *
 * 样式参考 AutoPlanMessage：无头像，纯内容卡片
 */
export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  isStreaming = false,
  onRetry,
  onCancel,
}) => {
  const { role, apiRole, status, iconText } = message;

  // 只处理 auto 角色的消息
  if (role !== 'auto') {
    return null;
  }

  return (
    <div className="w-full">
      {/* 消息卡片 - 参考 AutoPlanMessage 样式 */}
      <div className="py-1.5 space-y-1.5">
        {/* 消息内容区域：icon + content 同行，result 在下方 */}
        <MessageContent message={message} icon={<MessageIcon apiRole={apiRole} status={status} iconText={iconText} />} />

        {/* 操作按钮 */}
        {status === 'failed' && onRetry && (
          <div className="pt-1.5 flex gap-2">
            <button
              onClick={onRetry}
              className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
            >
              重试
            </button>
            {onCancel && (
              <button
                onClick={onCancel}
                className="text-xs text-gray-500 hover:text-gray-600 transition-colors"
              >
                取消
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessageItem;

// 导出子组件和类型
export { MessageIcon } from './MessageIcon';
export { MessageContent } from './MessageContent';
export type {
  MessageData,
  ApiRole,
  MessageStatus,
  MessageRole,
  FileAttachment,
  ChatMessageItemProps,
} from './types';
