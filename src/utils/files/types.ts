
import { v4 as uuidv4 } from 'uuid';

/**
 * 文件来源类型
 */
export type FileSource = 'user_input' | 'user_upload' | 'user_message' | 'execution_result' | 'step_output' | 'edit';

/**
 * 统一文件附件接口 - 简化版本
 * 移除冗余字段，只保留必要属性
 */
export interface UnifiedFileAttachment {
  id: string;
  name: string;
  type: string; // MIME类型
  content: string; // 统一使用content存储数据(base64或URL)
  size?: number;
  mimeType?: string; // 兼容旧格式
  dimensions?: {
    width: number;
    height: number;
  };
  metadata?: Record<string, any>;
  // 存储相关
  url?: string; // 文件URL（可能是storageUrl或其他URL）
  storageUrl?: string; // 云存储 URL
  isStored?: boolean; // 是否已存储到Storage
  isUploaded?: boolean; // 是否已上传
  uploadTimestamp?: number; // 上传时间戳
  // 处理状态
  isProcessing?: boolean;
  processingError?: string;
  // 文件分析结果
  fileAnalysisResult?: string; // 文件分析结果
  // 🔥 文件来源标记
  source?: 'user_message' | 'step_output' | 'edit' | 'user_upload';
  // 🔥 PPT URL（当文件为 PDF 预览时，pptUrl 用于下载 PPTX 版本）
  pptUrl?: string; // PPTX 文件下载地址（仅 PDF 预览文件使用）
}

/**
 * 文件处理配置
 */
export interface FileProcessingConfig {
  maxFileSize?: number; // 最大文件大小(字节)
  allowedTypes?: string[]; // 允许的文件类型
  autoUploadToStorage?: boolean; // 是否自动上传到Storage
  storageThreshold?: number; // 存储阈值(字节)，超过此大小自动上传Storage
  generatePreview?: boolean; // 是否生成预览
}

/**
 * 文件操作结果
 */
export interface FileOperationResult {
  success: boolean;
  message?: string;
  error?: string;
  files?: UnifiedFileAttachment[];
  file?: UnifiedFileAttachment;
}

/**
 * 文件显示配置
 */
export interface FileDisplayConfig {
  size: 'sm' | 'md' | 'lg';
  showActions?: boolean;
  showPreview?: boolean;
  compact?: boolean;
  maxDisplayCount?: number;
}



/**
 * 默认配置
 */
export const DEFAULT_FILE_CONFIG: FileProcessingConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: [
    'image/*',
    'video/*',
    'audio/*',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/*'
  ],
  autoUploadToStorage: true,
  storageThreshold: 1024 * 1024, // 1MB
  generatePreview: true
};

/**
 * 创建空文件对象
 */
export const createEmptyFile = (overrides?: Partial<UnifiedFileAttachment>): UnifiedFileAttachment => ({
  id: uuidv4(),
  name: '',
  type: 'application/octet-stream',
  content: '',
  ...overrides
});

/**
 * 文件类型检测工具
 */
export const FileTypeChecker = {
  isImage: (file: UnifiedFileAttachment): boolean => {
    return file.type.startsWith('image/') || 
           file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i) !== null;
  },
  
  isVideo: (file: UnifiedFileAttachment): boolean => {
    return file.type.startsWith('video/') ||
           file.name.toLowerCase().match(/\.(mp4|avi|mov|wmv|flv|webm)$/i) !== null;
  },
  
  isAudio: (file: UnifiedFileAttachment): boolean => {
    return file.type.startsWith('audio/') ||
           file.name.toLowerCase().match(/\.(mp3|wav|flac|aac|ogg)$/i) !== null;
  },
  
  isDocument: (file: UnifiedFileAttachment): boolean => {
    return file.type.includes('pdf') || 
           file.type.includes('document') ||
           file.type.includes('text') ||
           file.name.toLowerCase().match(/\.(pdf|doc|docx|txt|md)$/i) !== null;
  },
  
  isArchive: (file: UnifiedFileAttachment): boolean => {
    return file.name.toLowerCase().match(/\.(zip|rar|7z|tar|gz)$/i) !== null;
  }
};
