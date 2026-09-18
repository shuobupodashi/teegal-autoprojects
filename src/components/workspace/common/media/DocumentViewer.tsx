
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileAttachment } from '../../types/ChatTypes';
import { Download,  FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DocumentViewerProps {
  file: FileAttachment;
  isOpen: boolean;
  onClose: () => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ file, isOpen, onClose }) => {
  const [localFileUrl, setLocalFileUrl] = useState<string>('');
  
  const { t } = useTranslation();

  useEffect(() => {
    const loadLocalFile = async () => {
      const localPath = (file as any).localPath;
      const hasValidContent = file.content && (file.content.startsWith('data:') || file.content.startsWith('http'));
      const hasValidUrl = file.url && (file.url.startsWith('http') || file.url.startsWith('data:'));
      
      if (localPath && !hasValidContent && !hasValidUrl) {
        try {
          const electron = (window as any).electron;
          if (electron) {
            const readResult = await electron.readLocalFile({ localPath });
            
            if (readResult.success) {
              const mimeType = file.mimeType || file.type || 'application/pdf';
              const dataUrl = `data:${mimeType};base64,${readResult.content}`;
              setLocalFileUrl(dataUrl);
            }
          }
        } catch (error) {
          console.error('本地文档读取失败:', error);
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
    link.download = file.name || 'document';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const displayUrl = localFileUrl || file.content;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-6xl h-[85vh] p-0">
        <DialogHeader className="p-4 border-b pr-16">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">{file.name}</DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                {t('workspace.mediaViewer.document.download')}
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1">
          {isPDF && displayUrl ? (
            <iframe
              src={displayUrl}
              className="w-full h-full border-0"
              title={file.name}
            />
          ) : (
            <div className="h-full bg-gray-50 flex items-center justify-center p-8">
              <div className="text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 text-blue-600" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">{t('workspace.mediaViewer.document.preview')}</h3>
                <p className="text-gray-500 mb-4">
                  {isPDF 
                    ? t('workspace.mediaViewer.document.unableToPreviewPDF') 
                    : t('workspace.mediaViewer.document.unsupportedOnlinePreview')}
                  ，{t('workspace.mediaViewer.document.downloadAndOpenInSoftware')}
                </p>
                <Button onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-2" />
                  {t('workspace.mediaViewer.document.downloadFile')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentViewer;
