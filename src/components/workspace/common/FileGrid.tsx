import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FileAttachment } from "../types/ChatTypes";
import FilePreviewManager from "./FilePreviewManager";
import { AtSign, Trash2, Link, Copy } from "lucide-react"; // 🔥 导入图标

interface FileGridProps {
  files: FileAttachment[];
  title?: string;
  size?: "sm" | "md" | "lg" | "auto";
  showActions?: boolean;
  onFileView?: (file: FileAttachment) => void;
  onFileDownload?: (file: FileAttachment) => void;
  compact?: boolean;
  actionsVisibility?: 'hover' | 'always';
  // 🔥 新增：传递conversationId
  conversationId?: string;
  // 🔥 新增：传递snapshotId
  snapshotId?: string;
  // 🔥 新增：文件操作回调
  onFileQuickSelect?: (file: FileAttachment) => void; // 在ChatInput中插入文件ID
  onFileDelete?: (file: FileAttachment, snapshotId?: string) => void; // 删除文件
}

const FileGrid = ({
  files,
  title,
  size = "md",
  showActions = true,
  onFileView,
  onFileDownload,
  compact = false,
  actionsVisibility = 'hover',
  conversationId,
  snapshotId,
  onFileQuickSelect,
  onFileDelete
}: FileGridProps) => {
  const { t } = useTranslation();

  // 生成文件内容的简单哈希，用于检测文件内容变化
  const filesHash = files.map(f => 
    `${f.id}|${f.content?.length || 0}|${f.url}|${f.storageUrl}|${f.name}|${(f as any).editedAt || ''}`
  ).join(';');

  // Performance optimization: Cache processed files to prevent redundant processing
  const processedFiles = useMemo(() => {
    if (!files || files.length === 0) return [];

    // 移除重复的日志，仅在调试时启用
    // console.log("🚀 [FILE-GRID] Processing files (cached):", files.length);

    // 🔥 优化文件数据处理，确保与统一文件处理模块兼容
    return files
      .map((file) => {
        // 🔥 修复：优先级 localPath > content > storageUrl > url
        // localPath 是本地文件绝对路径，优先使用
        const localPath = (file as any).localPath;
        const storageUrl = (file as any).storageUrl;
        
        let content = "";
        if (localPath) {
          // 🔥 本地模式：使用 file:// 协议访问本地文件
          content = `file://${localPath}`;
        } else if (file.content && file.content.length > 0) {
          // 有 content（base64）
          content = file.content;
        } else if (storageUrl) {
          // 云端存储 URL
          content = storageUrl;
        } else if (file.url) {
          // 降级到 url
          content = file.url;
        }

        return {
          ...file,
          content,
          localPath, // 🔥 保持 localPath
          storageUrl, // 🔥 保持 storageUrl
          // 保持向后兼容
          base64: file.base64 || content,
          preview: content,
          originalBase64: file.originalBase64 || content,
          thumbnailBase64: file.thumbnailBase64 || content,
        };
      })
      .filter((file) => file.content && file.content.length > 0);
  }, [filesHash]);

  if (processedFiles.length === 0) return null;

  // 🔥 新增：auto尺寸的动态布局算法
  const getAutoLayout = () => {
    const fileCount = processedFiles.length;

    // 🔥 增大文件大小为 64px x 64px
    return {
      containerClass: "inline-flex",
      gridClass: "flex gap-2",
      itemSize: { width: "64px", height: "64px" },
      useCompact: true,
    };
  };

  // 🔥 优化网格布局，根据尺寸和环境调整
  const getGridColumns = () => {
    if (compact) {
      // 紧凑模式：更多列数，适用于小空间
      switch (size) {
        case "sm":
          return "grid-cols-6 sm:grid-cols-8 lg:grid-cols-10";
        case "lg":
          return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
        case "auto":
          return ""; // auto模式不使用固定网格
        default:
          return "grid-cols-4 sm:grid-cols-6 lg:grid-cols-8";
      }
    } else {
      // 标准模式：根据尺寸优化列数
      switch (size) {
        case "sm":
          return "grid-cols-4 sm:grid-cols-6 lg:grid-cols-8";
        case "lg":
          return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"; // 🔥 lg尺寸用更少列数
        case "auto":
          return ""; // auto模式不使用固定网格
        default:
          return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
      }
    }
  };

  // 🔥 动态间距，大尺寸使用更大间距
  const getGridGap = () => {
    if (compact) return "gap-2";

    switch (size) {
      case "lg":
        return "gap-4"; // 大尺寸用更大间距
      case "sm":
        return "gap-1";
      case "auto":
        return ""; // auto模式在布局算法中处理间距
      default:
        return "gap-2";
    }
  };
  // 🔥 获取布局配置
  const autoLayout = size === "auto" ? getAutoLayout() : null;

  return (
    <div className="space-y-3 w-full">
      {title && <h4 className="text-sm font-medium text-gray-700">{title}</h4>}

      {/* 🔥 auto尺寸使用动态布局，其他尺寸使用固定网格 */}
      {size === "auto" && autoLayout ? (
        <div className={`${autoLayout.containerClass} w-auto max-w-full`}>
          <div className={`${autoLayout.gridClass} w-auto max-w-full `}>
            {processedFiles.map((file) => (
              <div key={file.id} className="flex-shrink-0 flex flex-col">
                {/* 文件预览容器 */}
                <div style={autoLayout.itemSize}>
                  <FilePreviewManager
                    file={file}
                    size="md" // auto模式固定使用sm尺寸
                    showActions={showActions}
                    onFileView={onFileView}
                    onFileDownload={onFileDownload}
                    compact={autoLayout.useCompact}
                    customSize={autoLayout.itemSize}
                    actionsVisibility={actionsVisibility}
                    conversationId={conversationId}
                    // 🔥 传递snapshotId
                    snapshotId={snapshotId}
                  />
                </div>
                {/* 🔥 文件操作按钮 - 在预览下方 */}
                {(onFileQuickSelect || onFileDelete) && (
                  <div className="flex gap-1 mt-1 justify-center">
                    {onFileQuickSelect && (
                      <button
                        onClick={() => onFileQuickSelect(file)}
                        className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="在聊天框中引用此文件"
                      >
                        <AtSign size={14} />
                      </button>
                    )}
                    {onFileDelete && (
                      <button
                        onClick={() => onFileDelete(file, snapshotId)}
                        className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="删除此文件"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={`grid w-full ${getGridColumns()} ${getGridGap()} overflow-hidden`}>
          {processedFiles.map((file) => (
            <div key={file.id} className="flex flex-col">
              {/* 文件预览 */}
              <FilePreviewManager
                file={file}
                size={size === "auto" ? "sm" : size} // 🔥 修复：auto模式转换为sm，避免类型错误
                showActions={showActions}
                onFileView={onFileView}
                onFileDownload={onFileDownload}
                compact={compact}
                actionsVisibility={actionsVisibility}
                conversationId={conversationId}
                // 🔥 传递snapshotId
                snapshotId={snapshotId}
              />
              {/* 🔥 文件操作按钮 - 在预览下方 */}
                {(onFileQuickSelect || onFileDelete || file.url) && (
                  <div className="flex gap-1 mt-1 justify-center">
                    {onFileQuickSelect && (
                      <button
                        onClick={() => onFileQuickSelect(file)}
                        className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="在聊天框中引用此文件"
                      >
                        <AtSign size={14} />
                      </button>
                    )}
                    {/* 🔥 复制文件 URL 按钮 */}
                    {file.url && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(file.url);
                          // 可以添加 toast 提示
                        }}
                        className="p-1 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="复制文件URL"
                      >
                        <Copy size={14} />
                      </button>
                    )}
                    {onFileDelete && (
                      <button
                        onClick={() => onFileDelete(file, snapshotId)}
                        className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="删除此文件"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
            </div>
          ))}
        </div>
      )}

  

      {/* 🔥 auto模式的精简提示信息 */}
      {size === "auto" && processedFiles.length > 0 && (
        <div className="text-[10px] mt-1">
        </div>
      )}
    </div>
  );
};

export default FileGrid;