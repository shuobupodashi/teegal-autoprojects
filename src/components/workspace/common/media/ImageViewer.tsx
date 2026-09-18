import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Download, ExternalLink, Copy, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileAttachment } from '../../types/ChatTypes';
import { useWorkspace } from '@/hooks/workspace/useWorkspace';
import { useTranslation } from 'react-i18next';
import { getImageSource } from '@/utils/files/fileTypeUtils';

interface ImageViewerProps {
  file: FileAttachment;
  isOpen: boolean;
  onClose: () => void;
  showSmartProcessing?: boolean;
  conversationId?: string;
  snapshotId?: string;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ 
  file, 
  isOpen, 
  onClose,
  showSmartProcessing = false,
  conversationId: propConversationId,
  snapshotId: propSnapshotId
}) => {
  const workspace = useWorkspace();
  
  const conversationId = propConversationId || workspace.currentConversationId;
  const snapshotId = propSnapshotId;
  
  const { t } = useTranslation();
  
  const [imageSrc, setImageSrc] = useState<string>('');
  const [scale, setScale] = useState<number>(1);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const loadImage = async () => {
      const src = getImageSource(file);
      
      // 🔥 修复：处理 file:// 协议的本地文件路径
      if (src.startsWith('file://')) {
        const localPath = src.replace('file://', '');
        try {
          const electron = (window as any).electron;
          if (electron) {
            const readResult = await electron.readLocalFile({ localPath });
            
            if (readResult.success) {
              const mimeType = file.mimeType || file.type || 'image/png';
              const dataUrl = `data:${mimeType};base64,${readResult.content}`;
              setImageSrc(dataUrl);
              return;
            }
          }
        } catch (error) {
          console.error('本地图片读取失败:', error);
        }
        setImageSrc('');
      } else {
        setImageSrc(src);
      }
    };
    
    if (isOpen) {
      loadImage();
    }
  }, [isOpen, file]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setScale(prevScale => Math.min(prevScale + 0.1, 3));
    } else {
      setScale(prevScale => Math.max(prevScale - 0.1, 0.5));
    }
  };

  const handleDownload = () => {
    const src = imageSrc || file.content || file.url || '';
    if (src) {
      const link = document.createElement('a');
      link.href = src;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleOpenInNewWindow = () => {
    const src = file.content || file.url || '';
    if (src) {
      try {
        window.open(src, '_blank', 'noopener,noreferrer');
      } catch (e) {
        console.error('打开新窗口失败:', e);
      }
    }
  };

  const handleCopyLink = async () => {
    try {
      let copyUrl = '';
      if (file.url && file.url.startsWith('http')) {
        copyUrl = file.url;
      } else if (file.content && file.content.startsWith('http')) {
        copyUrl = file.content;
      } else {
        console.warn('文件链接不可用');
        return;
      }
      await navigator.clipboard.writeText(copyUrl);
      console.log('已复制文件链接');
    } catch (error) {
      console.error('复制链接失败:', error);
    }
  };

  const handleZoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.2, 3));
  };

  const handleZoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.2, 0.5));
  };

  const handleResetZoom = () => {
    setScale(1);
  };

  useEffect(() => {
    if (!isOpen) {
      setScale(1);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-4xl h-[85vh] p-0 bg-white rounded-lg overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>{file.name} {t('workspace.mediaViewer.image.title')}</DialogTitle>
        </VisuallyHidden>
        
        <div className="p-4 border-b flex justify-between items-center pr-16">
          <h3 className="text-lg font-medium truncate">{file.name}</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleOpenInNewWindow} title={t('workspace.mediaViewer.image.openNewWindow')}>
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyLink} title={t('workspace.mediaViewer.image.copyLink')}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} title={t('workspace.mediaViewer.image.download')}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="overflow-auto p-4" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          <div className="flex flex-col items-center justify-center">
            <div 
              className="relative mb-4 overflow-hidden"
              onWheel={handleWheel}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt={file.name}
                className="max-w-full max-h-[60vh] object-contain transition-transform duration-200"
                style={{ 
                  transform: `scale(${scale})`,
                  transformOrigin: 'center center'
                }}
              />
            </div>
            
            <div className="w-full max-w-2xl mb-4">
              <div className="flex gap-2 justify-end">
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={handleZoomOut} title={t('workspace.mediaViewer.image.zoomOut')}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleResetZoom} title={t('workspace.mediaViewer.image.resetZoom')}>
                    {Math.round(scale * 100)}%
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleZoomIn} title={t('workspace.mediaViewer.image.zoomIn')}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImageViewer;
