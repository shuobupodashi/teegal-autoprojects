
import { FileAttachment } from '@/components/workspace/types/ChatTypes';

/**
 * 数据库附件到文件附件的映射器
 */
export const mapDbAttachmentsToFileAttachments = (dbAttachments: any[]): FileAttachment[] => {
  if (!dbAttachments || !Array.isArray(dbAttachments)) {
    return [];
  }

  return dbAttachments.map((attachment: any) => ({
    id: attachment.id || `file_${Date.now()}_${Math.random()}`,
    name: attachment.name || 'Unknown File',
    type: attachment.type || 'application/octet-stream',
    content: attachment.content || attachment.base64 || '',
    url: attachment.url || attachment.preview || '',
    mimeType: attachment.mimeType || attachment.type,
    dimensions: attachment.dimensions
  }));
};
