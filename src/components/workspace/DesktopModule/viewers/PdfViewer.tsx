/**
 * PdfViewer - PDF 文件预览组件
 *
 * 支持：.pdf
 * - HTTP URL → 直接用 <iframe> 渲染（浏览器内置 PDF 阅读器）
 * - 本地文件 → 通过 electron IPC 以 base64 读取 → Blob URL → <iframe>
 */

import React, { useEffect, useState } from 'react';
import { Loader2, AlertTriangle, Download } from 'lucide-react';

/** 判断文件扩展名是否为 PDF 文件 */
export function isPdfFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return ext === 'pdf';
}

interface PdfViewerProps {
  filePath: string;
  fileName?: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ filePath, fileName }) => {
  const [src, setSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let blobUrl: string | null = null;

    const loadPdf = async () => {
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

        // base64 → Blob → Blob URL
        const byteChars = atob(base64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        blobUrl = URL.createObjectURL(blob);
        setSrc(blobUrl);
        setLoading(false);
      } catch (err: any) {
        console.error('[PdfViewer] 加载失败:', err);
        setError(err.message || '加载 PDF 失败');
        setLoading(false);
      }
    };

    loadPdf();

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [filePath]);

  const handleDownload = () => {
    if (src) {
      const a = document.createElement('a');
      a.href = src;
      a.download = fileName || 'document.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-sm text-gray-500">加载 PDF 中...</span>
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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-gray-50 dark:bg-gray-800">
        <span className="text-xs text-gray-600 dark:text-gray-300 truncate">
          {fileName || filePath}
        </span>
        <button
          onClick={handleDownload}
          className="text-gray-500 hover:text-blue-600 transition-colors"
          title="下载"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>
      <iframe
        src={src}
        className="flex-1 w-full border-0"
        title="PDF 预览"
      />
    </div>
  );
};

export default PdfViewer;
