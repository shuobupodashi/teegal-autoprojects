import React from 'react';

interface WaveformLoaderProps {
  className?: string;
  size?: number;
  barCount?: number;
  color?: string;
}

const WaveformLoader = ({ 
  className = "", 
  size = 40, 
  barCount = 4,
  color = "#10B981"
}: WaveformLoaderProps) => {
  const barWidth = size / (barCount * 2 + 1);
  const gap = barWidth;
  
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {Array.from({ length: barCount }).map((_, i) => {
        const x = gap + i * (barWidth + gap);
        const delay = i * 0.15;
        
        return (
          <rect
            key={i}
            x={x}
            y={size * 0.25}
            width={barWidth}
            height={size * 0.5}
            rx={barWidth / 2}
            fill={color}
          >
            <animate
              attributeName="height"
              values={`${size * 0.2};${size * 0.8};${size * 0.2}`}
              dur="1.2s"
              repeatCount="indefinite"
              begin={`${delay}s`}
              calcMode="spline"
              keySplines="0.4 0 0.2 1;0.4 0 0.2 1"
            />
            <animate
              attributeName="y"
              values={`${size * 0.4};${size * 0.1};${size * 0.4}`}
              dur="1.2s"
              repeatCount="indefinite"
              begin={`${delay}s`}
              calcMode="spline"
              keySplines="0.4 0 0.2 1;0.4 0 0.2 1"
            />
          </rect>
        );
      })}
    </svg>
  );
};

export default WaveformLoader;
