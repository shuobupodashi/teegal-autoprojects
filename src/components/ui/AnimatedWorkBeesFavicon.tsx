import React from 'react';

interface AnimatedWorkBeesFaviconProps {
  className?: string;
  size?: number;
}

const AnimatedWorkBeesFavicon = ({ className = "", size = 48 }: AnimatedWorkBeesFaviconProps) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 32 32" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 定义渐变色 */}
      <defs>
        <linearGradient id="footGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10B981" />  {/* 绿色 */}
          <stop offset="50%" stopColor="#3B82F6" />  {/* 蓝色 */}
          <stop offset="100%" stopColor="#F59E0B" />  {/* 橙色 */}
        </linearGradient>
      </defs>
      
      {/* 简化的蜜蜂头部 - 与脚部使用相同的浅色 */}
      <rect 
        x="4" 
        y="8" 
        width="24" 
        height="14" 
        rx="4" 
        fill="#f0f0f0" 
      />
      
      {/* 眼睛 */}
      <circle cx="12" cy="15" r="2" fill="#333" />
      <circle cx="20" cy="15" r="2" fill="#333" />
      
      {/* 动画脚 - 使用与原始favicon相同的位置作为初始位置 */}
      <g>
        {/* 第一只脚 - 初始位置与原始favicon相同 */}
        <circle cx="10" cy="24" r="3" fill="#f0f0f0">
          <animate 
            attributeName="cx" 
            values="10;7;13;10" 
            dur="2s" 
            repeatCount="indefinite" 
          />
        </circle>
        
        {/* 第二只脚 - 初始位置与原始favicon相同 */}
        <circle cx="16" cy="24" r="3" fill="#f0f0f0">
          <animate 
            attributeName="cx" 
            values="16;13;19;16" 
            dur="2s" 
            begin="0.2s"
            repeatCount="indefinite" 
          />
        </circle>
        
        {/* 第三只脚 - 初始位置与原始favicon相同 */}
        <circle cx="22" cy="24" r="3" fill="#f0f0f0">
          <animate 
            attributeName="cx" 
            values="22;19;25;22" 
            dur="2s" 
            begin="0.4s"
            repeatCount="indefinite" 
          />
        </circle>
      </g>
    </svg>
  );
};

export default AnimatedWorkBeesFavicon;