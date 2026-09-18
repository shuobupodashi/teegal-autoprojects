/**
 * VideoViewer - 本地视频文件预览组件
 *
 * 支持：mp4/webm/ogg/mov/avi/mkv
 * 通过 electron IPC 读取本地文件为 Blob URL 渲染
 */

import React, { useEffect, useState, useRef } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';

/** 判断文件扩展名是否为视频文件 */
export function isVideoFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(ext);
}

const MIME_MAP: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogg: 'video/ogg',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
};

interface VideoViewerProps {
  filePath: string;
  fileName?: string;
}

export const VideoViewer: React.FC<VideoViewerProps> = ({ filePath, fileName }) => {
  const [src, setSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let blobUrl: string | null = null;

    const loadVideo = async () => {
      setLoading(true);
      setError('');
      setSrc('');

      try {
        // HTTP URL 直接使用
        if (filePath.startsWith('http')) {
          setSrc(filePath);
          setLoading(false);
          return;
        }

        // 本地文件：通过 IPC 以 base64 读取
        const electron = (window as any).electron;
        if (!electron?.userpcFile?.read) {
          setError('无法读取本地文件');
          setLoading(false);
          return;
        }

        const result = await electron.userpcFile.read(filePath, 'base64');
        if (!result?.success) {
          setError(result?.error || '读取文件失败');
          setLoading(false);
          return;
        }

        const ext = filePath.split('.').pop()?.toLowerCase() || '';
        const mime = MIME_MAP[ext] || 'video/mp4';
        // base64 → Blob → Blob URL
        const base64 = result.data?.content;
        if (!base64) {
          setError('文件内容为空');
          setLoading(false);
          return;
        }
        const byteChars = atob(base64);
        const byteArray = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteArray[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([byteArray], { type: mime });
        blobUrl = URL.createObjectURL(blob);
        setSrc(blobUrl);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载视频失败');
        setLoading(false);
      }
    };

    loadVideo();

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [filePath]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 dark:bg-gray-900 text-gray-400">
        <AlertTriangle className="w-8 h-8 mb-2 text-yellow-500" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full bg-gray-900 p-4">
      <video
        ref={videoRef}
        src={src}
        controls
        className="max-w-full max-h-full"
      >
        您的浏览器不支持视频播放。
      </video>
    </div>
  );
};
