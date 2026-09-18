
/**
 * 兼容性适配器 - 用于平滑迁移
 * 将旧的FileAttachment格式转换为新的UnifiedFileAttachment格式
 */

import { UnifiedFileAttachment } from './types';
import { FileAttachment } from '@/components/workspace/types/ChatTypes';

/**
 * 将旧格式转换为新格式
 */
export const adaptLegacyFileAttachment = (
  legacyFile: FileAttachment
): UnifiedFileAttachment => {
  const result = {
    id: legacyFile.id,
    name: legacyFile.name,
    type: legacyFile.type,
    content: legacyFile.content || legacyFile.base64 || legacyFile.preview || legacyFile.url || '',
    size: undefined, // 旧格式没有size
    mimeType: legacyFile.mimeType || legacyFile.type,
    dimensions: legacyFile.dimensions,
    storageUrl: legacyFile.storageUrl,
    isStored: legacyFile.isUploaded,
    uploadTimestamp: legacyFile.uploadTimestamp,
    metadata: {}
  };
  
  return result;
};

