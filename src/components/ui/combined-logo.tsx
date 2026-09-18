import React from 'react';

interface CombinedLogoProps {
  className?: string;
  size?: number;
  headColor?: string;
  eyeColor?: string;
  footColor?: string;
}

const CombinedLogo = ({ 
  className = "", 
  size = 32,
  headColor = "#141313",
  eyeColor = "#262424",
  footColor = "#FCF7F7"
}: CombinedLogoProps) => {
  // 定义缩放比例
  const scale = size / 32;
  
  // 计算整体尺寸
  const svgWidth = 1227 * scale;
  const svgHeight = 800 * scale;

  return (
    <svg 
      width={svgWidth} 
      height={svgHeight} 
      viewBox="0 0 1227 800" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 定义渐变色 */}
      <defs>
        <linearGradient id="footGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="50%" stopColor="#9B87F5" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
      </defs>
      
      {/* 头部 (长方形) - Rectangle 1.svg */}
      <rect 
        x="0.541675" 
        y="102.427" 
        width="1169" 
        height="699" 
        transform="rotate(-5 0.541675 102.427)" 
        fill={headColor} 
        stroke="#343434"
      />
      
      {/* 眼睛 (椭圆) - Ellipse 1.svg */}
      {/* 第一个椭圆 */}
      <path 
        d="M210 197.354C210 255.344 162.99 302.354 105 302.354C47.0101 302.354 0 255.344 0 197.354C0 139.364 47.0101 92.3538 105 92.3538C162.99 92.3538 210 139.364 210 197.354Z" 
        fill={eyeColor}
        transform="translate(350, 100)"
      />
      
      {/* 第二个椭圆 */}
      <path 
        d="M803 105C803 162.99 755.99 210 698 210C640.01 210 593 162.99 593 105C593 47.0101 640.01 0 698 0C755.99 0 803 47.0101 803 105Z" 
        fill={eyeColor}
        transform="translate(200, 70)"
      />
      
      {/* 脚 (圆形) - Ellipse 2.svg */}
      <circle 
        cx="299" 
        cy="295" 
        r="295" 
        fill={footColor === "gradient" ? "url(#footGradient)" : footColor}
        transform="translate(300, 350)"
      />
    </svg>
  );
};

export default CombinedLogo;