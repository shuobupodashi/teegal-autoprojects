import React from 'react';
import { Dot } from 'lucide-react';
import { ApiRole, MessageStatus, IconConfig } from './types';
import { cn } from '@/lib/utils';

interface MessageIconProps {
  apiRole?: ApiRole;
  status?: MessageStatus;
  iconText?: string;
  className?: string;
}

/**
 * 🔥 使用圆点图标，简洁且不暗示可点击
 * 与 SessionMessageGroup 的 Chevron 区分，避免用户误以为可展开
 */
const getIconConfig = (apiRole?: ApiRole): IconConfig => {
  // 🔥 所有角色使用相同的圆点图标
  return {
    icon: Dot,
    color: 'text-gray-400',
    bgColor: '',
    label: '',
  };
};

/**
 * 根据状态获取动画效果
 */
const getStatusAnimation = (status?: MessageStatus): string => {
  // 🔥 移除所有动画效果
  return '';
};

/**
 * 消息图标组件
 * 
 * 根据 apiRole 显示不同的图标和颜色
 * 显示 iconText 在图标旁边
 */
export const MessageIcon: React.FC<MessageIconProps> = ({
  apiRole,
  status,
  iconText,
  className,
}) => {
  const config = getIconConfig(apiRole);
  const Icon = config.icon;
  const animation = getStatusAnimation(status);

  // 🔥 所有角色都使用自己的图标，不旋转
  const DisplayIcon = Icon;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* 圆点图标 - 固定容器宽度，内部圆点可调大小 */}
      <div className="w-4 h-4 flex items-center justify-center">
        <div className={cn('w-2 h-2 rounded-full bg-gray-400', animation)} />
      </div>

      {/* Icon 文本 - 浅灰色，更柔和 */}
      {iconText && (
        <span className={cn(
          'text-xs text-gray-400 dark:text-gray-500',
          animation
        )}>
          {iconText}
        </span>
      )}
    </div>
  );
};

export default MessageIcon;
