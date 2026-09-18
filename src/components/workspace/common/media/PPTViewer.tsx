
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileAttachment } from '../../types/ChatTypes';
import { Download, X, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PPTViewerProps {
  file: FileAttachment;
  isOpen: boolean;
  onClose: () => void;
}

const PPTViewer: React.FC<PPTViewerProps> = ({ file, isOpen, onClose }) => {
  const [viewerError, setViewerError] = useState(false);
  const [localFileUrl, setLocalFileUrl] = useState<string>('');
  
  const { t } = useTranslation();

  useEffect(() => {
    const loadLocalFile = async () => {
      const localPath = (file as any).localPath;
      const hasValidContent = file.content && file.content.startsWith('http');
      const hasValidUrl = file.url && file.url.startsWith('http');
      
      if (localPath && !hasValidContent && !hasValidUrl) {
        try {
          const electron = (window as any).electron;
          if (electron) {
            const readResult = await electron.readLocalFile({ localPath });
            
            if (readResult.success) {
              const mimeType = file.mimeType || file.type || 'application/vnd.ms-powerpoint';
              const dataUrl = `data:${mimeType};base64,${readResult.content}`;
              setLocalFileUrl(dataUrl);
            }
          }
        } catch (error) {
          console.error('本地PPT文件读取失败:', error);
        }
      }
    };
    
    if (isOpen) {
      loadLocalFile();
    }
  }, [isOpen, file]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = localFileUrl || file.content || file.url || '';
    link.download = file.name || 'presentation.ppt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewerError = () => {
    setViewerError(true);
    console.warn('⚠️ Google Docs Viewer 加载失败');
  };

  // 构建 Google Docs Viewer URL - 增强URL验证
  const getViewerUrl = () => {
    if (file.content && file.content.startsWith('http')) {
      // 检查是否为有效的公共HTTP/HTTPS URL
      const isValidPublicUrl = /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(file.content);
      if (isValidPublicUrl && !file.content.includes('blob:') && !file.content.includes('data:')) {
        return `https://docs.google.com/gview?url=${encodeURIComponent(file.content)}&embedded=true`;
      }
    }
    return null;
  };

  const viewerUrl = getViewerUrl();
  const canPreview = viewerUrl && !viewerError;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-6xl h-[85vh] p-0">
        <DialogHeader className="p-4 border-b pr-16">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">{file.name}</DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                {t('workspace.mediaViewer.ppt.download')}
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1">
          {canPreview ? (
            <iframe
              src={viewerUrl}
              className="w-full h-full border-0"
              title={`PPT预览: ${file.name}`}
              onError={handleViewerError}
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <div className="h-full bg-gray-50 flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                {viewerError ? (
                  <>
                    <AlertCircle className="w-16 h-16 mx-auto mb-4 text-orange-500" />
                    <h3 className="text-lg font-medium text-gray-700 mb-2">{t('workspace.mediaViewer.ppt.onlinePreviewFailed')}</h3>
                    <p className="text-gray-500 mb-4">
                      {t('workspace.mediaViewer.ppt.googleDocsViewerCannotAccessFile')}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-6xl mb-4">📊</div>
                    <h3 className="text-lg font-medium text-gray-700 mb-2">{t('workspace.mediaViewer.ppt.pptFile')}</h3>
                    <p className="text-gray-500 mb-4">
                      {t('workspace.mediaViewer.ppt.pptFileRequiresDownload')}
                    </p>
                  </>
                )}
                
                <div className="flex gap-3 justify-center">
                  <Button onClick={handleDownload} className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    {t('workspace.mediaViewer.ppt.downloadFile')}
                  </Button>
                  {file.content?.startsWith('http') && !file.content.includes('blob:') && (
                    <Button variant="outline" onClick={() => window.open(file.content, '_blank')} className="flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" />
                      {t('workspace.mediaViewer.ppt.openInNewWindow')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PPTViewer;
