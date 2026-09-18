
import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileAttachment } from '../../types/ChatTypes';
import { useTranslation } from 'react-i18next';

interface AudioPlayerProps {
  file: FileAttachment;
  isOpen: boolean;
  onClose: () => void;
  showSmartProcessing?: boolean;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ file, isOpen, onClose,
  showSmartProcessing = false }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localAudioSrc, setLocalAudioSrc] = useState<string>('');
  
  const { t } = useTranslation();

  useEffect(() => {
    const loadLocalAudio = async () => {
      const localPath = (file as any).localPath;
      const hasValidContent = file.content && (file.content.startsWith('data:') || file.content.startsWith('http'));
      const hasValidUrl = file.url && (file.url.startsWith('http') || file.url.startsWith('data:'));
      
      if (localPath && !hasValidContent && !hasValidUrl) {
        try {
          const electron = (window as any).electron;
          if (electron) {
            const readResult = await electron.readLocalFile({ localPath });
            
            if (readResult.success) {
              const mimeType = file.mimeType || file.type || 'audio/mpeg';
              const dataUrl = `data:${mimeType};base64,${readResult.content}`;
              setLocalAudioSrc(dataUrl);
            }
          }
        } catch (error) {
          console.error('本地音频读取失败:', error);
          setError('本地音频读取失败');
        }
      }
    };
    
    if (isOpen) {
      loadLocalAudio();
    }
  }, [isOpen, file]);

  useEffect(() => {
   const audio = audioRef.current;
    if (!audio) return;

    if (!isOpen) return;

    // 主动触发元数据加载：在弹窗打开且未加载元数据时调用
    if (audio.readyState === 0) {
      audio.load();
    }

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      console.log('🎵 [AudioPlayer] 音频时长更新:', audio.duration);
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
        setError(null);
      }
    };
    const handleEnded = () => setIsPlaying(false);
    const handleLoadStart = () => {
      setIsLoading(true);
      setError(null);
    };
    const handleLoadedData = () => {
      setIsLoading(false);
      console.log('🎵 [AudioPlayer] 音频数据加载完成, 时长:', audio.duration);
      // Additional check when audio data is loaded
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
        setError(null);
      }
    };
    const handleError = () => {
      setIsLoading(false);
      setError('音频加载失败');
      console.error('🎵 [AudioPlayer] 音频加载失败');
    };
    const handleCanPlay = () => {
      setIsLoading(false);
      console.log('🎵 [AudioPlayer] 音频可以播放, 时长:', audio.duration);
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
        setError(null);
      }
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('durationchange', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);

    // Force duration update if audio is already loaded
    if (audio.readyState >= 1) {
      updateDuration();
    }

    // 🔥 添加跨域属性以支持外部音频文件
    audio.crossOrigin = 'anonymous';

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('durationchange', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [isOpen, file.content, file.url]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newVolume = value[0];
    audio.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (isMuted) {
      audio.volume = volume;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

   const formatTime = (time: number) => {
    if (!time || isNaN(time) || !isFinite(time)) {
      return '0:00';
    }
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = localAudioSrc || file.content || file.url || '';
    link.download = file.name || 'audio';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pr-12">
          <DialogTitle className="flex items-center justify-between">
            <span>{file.name}</span>
            <Button variant="outline" size="sm" onClick={handleDownload} title={t('workspace.mediaViewer.audio.download')}>
              <Download className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <audio
            ref={audioRef}
            src={localAudioSrc || file.content || file.url}
            preload="metadata"
            crossOrigin="anonymous"
            className="hidden"
            onLoadedMetadata={() => {
              const a = audioRef.current;
              if (!a) return;
              if (a.duration && !isNaN(a.duration) && isFinite(a.duration)) {
                setDuration(a.duration);
                setError(null);
              }
            }}
            onCanPlay={() => {
              const a = audioRef.current;
              if (!a) return;
              if (a.duration && !isNaN(a.duration) && isFinite(a.duration)) {
                setDuration(a.duration);
                setError(null);
              }
            }}
            onTimeUpdate={() => {
              const a = audioRef.current;
              if (!a) return;
              setCurrentTime(a.currentTime);
            }}
          />
          
          {/* 播放进度 */}
          <div className="space-y-2">
            <Slider
              value={[currentTime]}
              max={duration > 0 ? duration : 100}
              step={1}
              onValueChange={handleSeek}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-500">
              <span>{formatTime(currentTime)}</span>
              <span>{isLoading ? t('workspace.mediaViewer.audio.loading') : error ? t('workspace.mediaViewer.audio.unknownDuration') : formatTime(duration)}</span>
            </div>
          </div>
          
          {/* 控制按钮 */}
          <div className="flex items-center justify-center space-x-4">
            <Button variant="outline" size="sm" onClick={togglePlay} title={isPlaying ? t('workspace.mediaViewer.audio.pause') : t('workspace.mediaViewer.audio.play')}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={toggleMute} title={isMuted ? t('workspace.mediaViewer.audio.unmute') : t('workspace.mediaViewer.audio.mute')}>
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.1}
                onValueChange={handleVolumeChange}
                className="w-20"
              />
            </div>
          </div>
        </div>
                
      </DialogContent>
    </Dialog>
  );
};

export default AudioPlayer;
