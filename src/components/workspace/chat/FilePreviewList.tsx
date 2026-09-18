import React from 'react';
import { FileAttachment } from '@/components/workspace/types/ChatTypes';
import FilePreviewManager from '@/components/workspace/common/FilePreviewManager';

interface FilePreviewListProps {
  files: FileAttachment[];
  onRemoveFile?: (id: string) => void;
  showActions?: boolean;
  actionsVisibility?: 'hover' | 'always';
}

const FilePreviewList: React.FC<FilePreviewListProps> = ({
  files,
  onRemoveFile,
  showActions = true,
  actionsVisibility = 'always'
}) => {
  if (!files || files.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {files.map((file, index) => (
        <div key={file.id || index} className="relative">
          <FilePreviewManager
            file={file}
            size="sm"
            showActions={showActions}
            actionsVisibility={actionsVisibility}
          />
          {onRemoveFile && (
            <button
              onClick={() => onRemoveFile(file.id || '')}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 z-10"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default React.memo(FilePreviewList);
