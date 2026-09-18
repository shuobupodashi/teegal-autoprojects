import React from 'react';
import { FileAttachment } from '../../types/ChatTypes';
import ImageViewer from './ImageViewer';
import AudioPlayer from './AudioPlayer';
import VideoPlayer from './VideoPlayer';
import DocumentViewer from './DocumentViewer';
import CodeFileViewer from './CodeFileViewer';
import { FileUtils } from '@/utils/files';

interface MediaViewerProps {
  file: FileAttachment;
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string;
  snapshotId?: string;
  onFileSave?: (updatedFile: FileAttachment) => void;
}

const MediaViewer: React.FC<MediaViewerProps> = ({ 
  file, 
  isOpen, 
  onClose,
  conversationId,
  snapshotId,
  onFileSave
}) => {
  const isDocumentFile = (file: FileAttachment): boolean => {
    return file.type.includes('document') ||
           file.name.toLowerCase().match(/\.(doc|docx|txt|pdf)$/i) !== null;
  };

  const isMarkdownFile = (file: FileAttachment): boolean => {
    return file.type === 'text/markdown' ||
           file.type === 'application/markdown' ||
           file.mimeType === 'text/markdown' ||
           file.name.toLowerCase().endsWith('.md');
  };

  const isHTMLFile = (file: FileAttachment): boolean => {
    return file.type === 'text/html' ||
           file.mimeType === 'text/html' ||
           file.name.toLowerCase().endsWith('.html') ||
           file.name.includes('幻灯片');
  };

  const isCodeFile = (file: FileAttachment): boolean => {
    const codeExtensions = [
      'py', 'python', 'js', 'javascript', 'ts', 'typescript', 
      'tsx', 'jsx', 'json', 'yaml', 'yml', 'md', 'markdown',
      'css', 'scss', 'sass', 'less', 'html', 'htm', 'xml',
      'sql', 'sh', 'bash', 'zsh', 'dockerfile', 'graphql', 'gql',
      'txt', 'log', 'ini', 'conf', 'env'
    ];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    return codeExtensions.includes(ext);
  };

  if (FileUtils.isImage(file)) {
    return (
      <ImageViewer
        isOpen={isOpen}
        onClose={onClose}
        file={file}
        conversationId={conversationId}
        snapshotId={snapshotId}
      />
    );
  }

  if (FileUtils.isVideo(file)) {
    return (
      <VideoPlayer
        file={file}
        isOpen={isOpen}
        onClose={onClose}
      />
    );
  }

  if (FileUtils.isAudio(file)) {
    return (
      <AudioPlayer
        file={file}
        isOpen={isOpen}
        onClose={onClose}
      />
    );
  }

  if (isMarkdownFile(file)) {
    return (
      <CodeFileViewer
        file={file}
        isOpen={isOpen}
        onClose={onClose}
      />
    );
  }

  if (isHTMLFile(file)) {
    return (
      <DocumentViewer
        file={file}
        isOpen={isOpen}
        onClose={onClose}
      />
    );
  }

  if (isCodeFile(file)) {
    return (
      <CodeFileViewer
        file={file}
        isOpen={isOpen}
        onClose={onClose}
      />
    );
  }

  if (isDocumentFile(file)) {
    return (
      <DocumentViewer
        file={file}
        isOpen={isOpen}
        onClose={onClose}
      />
    );
  }

  if (isOpen) {
    const link = document.createElement('a');
    link.href = file.content || file.url || '';
    link.download = file.name || 'download';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onClose();
  }

  return null;
};

export default MediaViewer;
