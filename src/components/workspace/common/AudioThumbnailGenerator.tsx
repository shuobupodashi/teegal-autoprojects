import React, { useEffect, useState, useRef } from 'react';
import { Music } from 'lucide-react';

interface AudioThumbnailGeneratorProps {
  audioSrc: string;
  className?: string;
}

/**
 * 音频缩略图生成器
 * 为音频文件生成波形可视化缩略图
 */
export const AudioThumbnailGenerator: React.FC<AudioThumbnailGeneratorProps> = ({
  audioSrc,
  className = "",
}) => {
  const [thumbnail, setThumbnail] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!audioSrc || thumbnail) return;

    const generateAudioThumbnail = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      try {
        setIsLoading(true);
        
        // 创建音频上下文
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // 加载音频数据
        const response = await fetch(audioSrc);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // 获取音频数据
        const channelData = audioBuffer.getChannelData(0);
        const samples = 100; // 采样点数
        const blockSize = Math.floor(channelData.length / samples);
        
        // 设置canvas尺寸
        const width = 320;
        const height = 180;
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // 绘制渐变背景
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        // 绘制波形
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let i = 0; i < samples; i++) {
          const x = (width / samples) * i;
          let sum = 0;
          
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[i * blockSize + j]);
          }
          
          const amplitude = sum / blockSize;
          const y = height / 2 + (amplitude * height / 2) * (Math.random() > 0.5 ? 1 : -1);
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        ctx.stroke();
        
        // 添加音乐图标
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♪', width / 2, height / 2);
        
        const thumbnailData = canvas.toDataURL('image/jpeg', 0.8);
        setThumbnail(thumbnailData);
        setIsLoading(false);
        
        console.log('✅ [AUDIO-THUMBNAIL] 音频缩略图生成成功');
      } catch (error) {
        console.error('❌ [AUDIO-THUMBNAIL] 生成失败:', error);
        
        // 降级方案：生成纯色背景 + 图标
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = 320;
            canvas.height = 180;
            
            // 渐变背景
            const gradient = ctx.createLinearGradient(0, 0, 0, 180);
            gradient.addColorStop(0, '#667eea');
            gradient.addColorStop(1, '#764ba2');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 320, 180);
            
            // 音乐图标
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.font = 'bold 64px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('♪', 160, 90);
            
            const thumbnailData = canvas.toDataURL('image/jpeg', 0.8);
            setThumbnail(thumbnailData);
          }
        }
        setIsLoading(false);
      }
    };

    generateAudioThumbnail();
  }, [audioSrc, thumbnail]);

  return (
    <>
      <canvas ref={canvasRef} className="hidden" />
      {thumbnail ? (
        <img src={thumbnail} alt="音频缩略图" className={className} />
      ) : isLoading ? (
        <div className={`${className} flex items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-600`}>
          <Music className="w-12 h-12 text-white animate-pulse" />
        </div>
      ) : (
        <div className={`${className} flex items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-600`}>
          <Music className="w-12 h-12 text-white" />
        </div>
      )}
    </>
  );
};

export default AudioThumbnailGenerator;
