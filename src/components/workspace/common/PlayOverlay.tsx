import React from 'react';
import { Play, Eye } from 'lucide-react';

interface PlayOverlayProps {
  type: 'video' | 'audio' | 'image';
  onClick?: () => void;
}

/**
 * 播放/查看覆盖层组件
 * - video/audio: 显示播放按钮
 * - image: 显示眼睛图标
 */
export const PlayOverlay: React.FC<PlayOverlayProps> = ({ type, onClick }) => {
  const isMedia = type === 'video' || type === 'audio';
  const Icon = isMedia ? Play : Eye;
  
  return (
    <div 
      className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center cursor-pointer"
      onClick={onClick}
    >
      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform group-hover:scale-110">
        <div className="bg-white bg-opacity-90 rounded-full p-4 shadow-lg">
          <Icon className={`w-8 h-8 ${isMedia ? 'text-primary ml-1' : 'text-primary'}`} />
        </div>
      </div>
    </div>
  );
};

export default PlayOverlay;
