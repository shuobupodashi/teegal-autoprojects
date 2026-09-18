import { 
  isImage as isImageAdvanced, 
  isVideo as isVideoAdvanced, 
  isAudio as isAudioAdvanced 
} from '@/utils/files/fileTypeUtils';

export {
  uploadFileToStorage,
  createFilePreview,
  createFilePreviews,
  uploadFilesToStorage
} from './fileUploadStorage';

export {
  saveFileToLocal,
  readFileFromLocal,
  createLightweightFileAttachment
} from './localFileStorage';

export type {
  UnifiedFileAttachment,
  FileProcessingConfig,
  FileOperationResult,
  FileDisplayConfig,
  FileSource
} from './types';

export {
  DEFAULT_FILE_CONFIG,
  FileTypeChecker,
  createEmptyFile
} from './types';

export type { UnifiedFileAttachment as FileAttachment } from './types';

export { adaptLegacyFileAttachment } from './compatibility';

export { resultFileStorage, uploadFileToCloud } from './resultFileStorage';

const adaptToFileAttachment = (file: { type: string; name: string } | File | any): any => {
  if (file && typeof file === 'object' && 'name' in file && 'type' in file) {
    return {
      name: file.name || '',
      type: file.type || '',
      url: file.url || '',
      content: file.content || '',
      base64: file.base64 || '',
      preview: file.preview || '',
    };
  }
  return {
    name: file.name || '',
    type: file.type || '',
    url: '',
    content: '',
    base64: '',
    preview: '',
  };
};

export const FileUtils = {
  isImage: (file: { type: string; name: string } | File | any) => {
    const adaptedFile = adaptToFileAttachment(file);
    return isImageAdvanced(adaptedFile);
  },

  isVideo: (file: { type: string; name: string } | File | any) => {
    const adaptedFile = adaptToFileAttachment(file);
    return isVideoAdvanced(adaptedFile);
  },

  isAudio: (file: { type: string; name: string } | File | any) => {
    const adaptedFile = adaptToFileAttachment(file);
    return isAudioAdvanced(adaptedFile);
  },

  formatFileSize: (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  getFileExtension: (filename: string): string => {
    return filename.split('.').pop()?.toLowerCase() || '';
  },
};
