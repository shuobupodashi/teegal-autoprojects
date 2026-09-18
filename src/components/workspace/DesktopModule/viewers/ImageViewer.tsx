/**
 * ImageViewer - 本地图片文件预览组件
 *
 * 支持：jpg/jpeg/png/gif/webp/bmp/svg
 * 通过 electron IPC 读取本地文件为 Blob URL 渲染
 */

import React, { useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';

/** 判断文件扩展名是否为图片文件 */
export function isImageFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
}

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
};

interface ImageViewerProps {
  filePath: string;
  fileName?: string;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ filePath, fileName }) => {
  const [src, setSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let blobUrl: string | null = null;

    const loadImage = async () => {
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
        const mime = MIME_MAP[ext] || 'image/jpeg';
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
        setError(err instanceof Error ? err.message : '加载图片失败');
        setLoading(false);
      }
    };

    loadImage();

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
    <div className="flex items-center justify-center h-full bg-gray-900 overflow-auto p-4">
      <img
        src={src}
        alt={fileName || filePath}
        className="max-w-full max-h-full object-contain"
      />
    </div>
  );
};
