/**
 * AudioViewer - 音频文件预览组件
 *
 * 支持：mp3/wav/ogg/m4a/flac/aac
 * - HTTP URL → 直接用 <audio> 渲染
 * - 本地文件 → 通过 electron IPC 以 base64 读取 → Blob URL → <audio>
 *
 * 注意：本组件仅负责播放预览。
 * 若需音频转文字，应作为独立的业务操作（如 Chat tool 调用 LLM/Whisper），不在此内置。
 */

import React, { useEffect, useState } from 'react';
import { Loader2, AlertTriangle, Music } from 'lucide-react';

/** 判断文件扩展名是否为音频文件 */
export function isAudioFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext);
}

const MIME_MAP: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  aac: 'audio/aac',
};

interface AudioViewerProps {
  filePath: string;
  fileName?: string;
}

export const AudioViewer: React.FC<AudioViewerProps> = ({ filePath, fileName }) => {
  const [src, setSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let blobUrl: string | null = null;

    const loadAudio = async () => {
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

        const base64 = result.data?.content;
        if (!base64) {
          setError('文件内容为空');
          setLoading(false);
          return;
        }

        const ext = filePath.split('.').pop()?.toLowerCase() || 'mp3';
        const mime = MIME_MAP[ext] || 'audio/mpeg';
        // base64 → Blob → Blob URL
        const byteChars = atob(base64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([new Uint8Array(byteNumbers)], { type: mime });
        blobUrl = URL.createObjectURL(blob);
        setSrc(blobUrl);
        setLoading(false);
      } catch (err: any) {
        console.error('[AudioViewer] 加载失败:', err);
        setError(err.message || '加载音频失败');
        setLoading(false);
      }
    };

    loadAudio();

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [filePath]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-sm text-gray-500">加载音频中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <AlertTriangle className="h-10 w-10 text-orange-400 mb-2" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 bg-gray-50 dark:bg-gray-900">
      <Music className="h-16 w-16 text-blue-400 mb-4" />
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4 truncate max-w-full">
        {fileName || filePath.split('/').pop()}
      </p>
      <audio
        src={src}
        controls
        className="w-full max-w-md"
      >
        您的浏览器不支持音频播放
      </audio>
    </div>
  );
};

export default AudioViewer;
