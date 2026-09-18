import React, { useState, useMemo, useEffect } from 'react';
import { FileAttachment } from '../types/ChatTypes';
import { 
  getFileIcon, 
  getFileColor, 
  getFileTypeLabel,
  isImage, 
  hasImageData, 
  getImageSource, 
  getSizeClasses, 
  getIconSizes,
  isVideo,
  isAudio
} from '@/utils/files/fileTypeUtils';
import MediaViewer from './media/MediaViewer';
import { VideoThumbnailExtractor } from './VideoThumbnailExtractor';
import { AudioThumbnailGenerator } from './AudioThumbnailGenerator';
import FileUploadProgress from './FileUploadProgress';

interface FilePreviewManagerProps {
  file: FileAttachment;
  size?: 'sm' | 'md' | 'lg';
  showActions?: boolean;
  onFileView?: (file: FileAttachment) => void;
  onFileDownload?: (file: FileAttachment) => void;
  onView?: (file: FileAttachment) => void;
  onDownload?: (file: FileAttachment) => void;
  compact?: boolean;
  // 🔥 新增：自定义尺寸支持，用于动态布局
  customSize?: { width: string; height: string };
  actionsVisibility?: 'hover' | 'always';
  // 🔥 新增：传递conversationId
  conversationId?: string;
  // 🔥 新增：传递snapshotId
  snapshotId?: string;
  // 🔥 新增：文件保存回调
  onFileSave?: (updatedFile: FileAttachment) => void;
}

const FilePreviewManager: React.FC<FilePreviewManagerProps> = ({ 
  file, 
  size = 'md',
  showActions = false,
  onFileView,
  onFileDownload,
  onView,
  onDownload,
  compact = false,
  customSize,
  actionsVisibility = 'hover',
  conversationId,
  snapshotId,
  onFileSave
}) => {
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  
  // 🔥 新增：维护更新后的文件对象，包含下载的 base64 内容
  const [enhancedFile, setEnhancedFile] = useState<FileAttachment>(file);
  
  // 🔥 Performance optimization: Cache file type information to prevent redundant checks
  const fileTypeInfo = useMemo(() => {
    const fileIsImage = isImage(file);
    const fileIsVideo = isVideo(file);
    const fileIsAudio = isAudio(file);
    const fileHasImageData = fileIsImage ? hasImageData(file) : false;
    
    // 移除重复的日志，仅在调试时启用
    // console.log('🚀 [FILE-PREVIEW-MANAGER] Cached file type info for:', file.name, { isImage: fileIsImage, isVideo: fileIsVideo });
    
    return {
      isImage: fileIsImage,
      isVideo: fileIsVideo,
      isAudio: fileIsAudio,
      hasImageData: fileHasImageData
    };
  }, [file.id, file.type, file.content, file.name]);

  // 🔥 缩略图图片地址（可替换为代理下载后的地址）
  // 🔥 修复：优先使用已存在的 base64 内容，避免不必要的网络请求和 COEP 错误
  const getInitialImageSrc = () => {
    if (!fileTypeInfo.isImage) return '';
    
    // 优先检查文件中是否已存在可用的 base64 内容
    const contentSources = [
      file.base64,
      file.content,
      file.preview,
      file.originalBase64,
      file.thumbnailBase64
    ];
    
    for (const source of contentSources) {
      if (source && (source.startsWith('data:image/') || (source.length > 1000 && !source.startsWith('http')))) {
        console.log('✅ [FILE-PREVIEW-MANAGER] 使用已存在的 base64 内容作为初始图片源');
        return source;
      }
    }
    
    // 如果没有可用的 base64 内容，再尝试使用 getImageSource
    return getImageSource(file);
  };
  
  const [imageSrc, setImageSrc] = useState<string>(getInitialImageSrc());
  const [isLoadingLocalImage, setIsLoadingLocalImage] = useState(false);
  
  useEffect(() => {
    // 🔥 修复：处理 file:// 协议的本地文件路径
    if (imageSrc && imageSrc.startsWith('file://')) {
      const localPath = imageSrc.replace('file://', '');
      setIsLoadingLocalImage(true);
      const loadLocalImage = async () => {
        try {
          const electron = (window as any).electron;
          if (electron) {
            const readResult = await electron.readLocalFile({ localPath });
            
            if (readResult.success) {
              const mimeType = file.mimeType || file.type || 'image/png';
              const dataUrl = `data:${mimeType};base64,${readResult.content}`;
              setImageSrc(dataUrl);
            } else {
              console.error('❌ [FILE-PREVIEW-MANAGER] 本地文件读取失败:', readResult.error);
              // 读取失败时，清空 imageSrc 触发 onError 走下载逻辑
              setImageSrc('');
            }
          } else {
            // 没有 electron 环境，无法读取本地文件
            setImageSrc('');
          }
        } catch (error) {
          console.error('❌ [FILE-PREVIEW-MANAGER] 本地图片读取失败:', error);
          setImageSrc('');
        } finally {
          setIsLoadingLocalImage(false);
        }
      };
      loadLocalImage();
    }
  }, [imageSrc, file.mimeType, file.type]);
  
  // 移除重复的日志，仅在调试时启用
  // const initialImageSrc = getInitialImageSrc();
  // console.log('🖼️ [FILE-PREVIEW-MANAGER] 图片源初始化:', { fileName: file.name });

  // 🔥 Cache UI-related information
  const fileDisplayInfo = useMemo(() => {
    const IconComponent = getFileIcon(file);
    const colorClass = getFileColor(file);
    const typeLabel = getFileTypeLabel(file);
    const imageSource = fileTypeInfo.hasImageData ? getInitialImageSrc() : '';
    
    return {
      IconComponent,
      colorClass,
      typeLabel,
      imageSource
    };
  }, [file.id, file.type, file.name, fileTypeInfo.hasImageData, imageSrc]);
  
  const sizeClasses = getSizeClasses(size);
  const iconSizes = getIconSizes();
  const iconSize = iconSizes[size];
  
  // 移除重复的日志，仅在调试时启用
  // console.log('📁 [FILE-PREVIEW-MANAGER] 渲染文件预览:', { fileName: file.name, fileType: file.type });

  // 🔥 统一文件查看逻辑：点击直接打开 MediaViewer
  const handleView = () => {
    console.log('👁️ [FILE-PREVIEW-MANAGER] 打开文件查看器:', file.name, '当前showMediaViewer:', showMediaViewer);
    
    // 🔥 所有文件类型（包括 HTML）都通过 MediaViewer 统一处理
    setShowMediaViewer(true);
    console.log('✅ [FILE-PREVIEW-MANAGER] 已调用 setShowMediaViewer(true)');
  };

  // Use cached file type information
  const shouldShowImage = fileTypeInfo.hasImageData;
  const shouldShowVideoThumbnail = fileTypeInfo.isVideo && !shouldShowImage;
  const shouldShowAudioThumbnail = fileTypeInfo.isAudio && !shouldShowImage;
  
  // 检查视频/音频源是否可用（有效的 http、data 或 base64 内容）
  const isMediaSourceAvailable = useMemo(() => {
    const source = file.content || file.url || '';
    if (!source) return false;
    // 有效的源：http/https URL、data URL、base64 内容
    return source.startsWith('http') || source.startsWith('data:') || (source.length > 100 && source.includes(','));
  }, [file.content, file.url]);
  
  // 获取媒体源地址
  const mediaSource = useMemo(() => {
    if (!shouldShowVideoThumbnail && !shouldShowAudioThumbnail) return '';
    // 只有当媒体源可用时才返回，否则返回空字符串
    if (!isMediaSourceAvailable) return '';
    return file.content || file.url || '';
  }, [shouldShowVideoThumbnail, shouldShowAudioThumbnail, isMediaSourceAvailable, file.content, file.url]);
  
  // 确定overlay类型
  const overlayType: 'video' | 'audio' | 'image' = fileTypeInfo.isVideo ? 'video' : fileTypeInfo.isAudio ? 'audio' : 'image';
  
  // 紧凑模式的尺寸调整
  const getCompactSizeClasses = () => {
    // 🔥 如果有自定义尺寸，使用内联样式而不是动态类名
    if (customSize) {
      return 'w-full h-full'; // 使用父容器的尺寸
    }
    
    if (!compact) return sizeClasses;
    
    switch (size) {
      case 'sm': return 'w-12 h-12';
      case 'lg': return 'w-28 h-28';
      default: return 'w-20 h-20';
    }
  };
  
  // 🔥 获取容器样式（用于自定义尺寸）
  const getContainerStyle = () => {
    if (customSize) {
      return {
        width: customSize.width,
        height: customSize.height
      };
    }
    return {};
  };
  
  // 🔥 新增：当 file prop 改变时，同步更新 enhancedFile
  React.useEffect(() => {
    setEnhancedFile(file);
  }, [file.id, (file as any).editedAt, file.name, (file as any).localPath]);

  return (
    <>
      <div 
        className={`${getCompactSizeClasses()} relative group border rounded-lg overflow-hidden bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer`} 
        style={getContainerStyle()}
        onMouseEnter={() => {
          // 移除重复的日志，仅在调试时启用
          // console.log('👁 [FILE-PREVIEW-MANAGER] 鼠标移入:', file.name);
        }}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          // 移除重复的日志，仅在调试时启用
          // console.log('💆 [FILE-PREVIEW-MANAGER] 容器点击事件:', file.name);
          handleView();
        }}
      >
        {shouldShowImage ? (
          <div className="w-full h-full relative">
            {/* 🔥 如果正在加载本地文件，显示加载状态 */}
            {isLoadingLocalImage || imageSrc.startsWith('file://') ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-100">
                <div className="animate-pulse flex flex-col items-center">
                  <div className="w-8 h-8 bg-gray-300 rounded-full mb-2"></div>
                  <div className="text-xs text-gray-400">加载中...</div>
                </div>
              </div>
            ) : (
              <img
                src={imageSrc || getInitialImageSrc()}
                alt={file.name}
                className="w-full h-full object-cover"
                onError={() => {
                  console.warn('图片加载失败:', file.name);
                }}
              />
            )}
          </div>
        ) : shouldShowVideoThumbnail ? (
          <div className="w-full h-full relative">
            <VideoThumbnailExtractor
              videoSrc={mediaSource}
              className="w-full h-full object-cover"
            />
          </div>
        ) : shouldShowAudioThumbnail ? (
          <div className="w-full h-full relative">
            <AudioThumbnailGenerator
              audioSrc={mediaSource}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div 
            className="w-full h-full flex flex-col items-center justify-center p-2"
            onClick={(e) => {
              // 移除重复的日志，仅在调试时启用
              // console.log('📝 [FILE-PREVIEW-MANAGER] 文件图标区域点击', file.name);
              // 🔥 不阻止事件，让它冒泡到父容器
            }}
          >
            <fileDisplayInfo.IconComponent 
              size={compact ? Math.max(16, iconSize - 2) : iconSize} 
              className={fileDisplayInfo.colorClass}
            />
            <div className="text-[9px] text-center mt-1 px-1 w-full leading-tight">
              {(() => {
                const fileName = file.name;
                // 🔥 文件名省略显示：前12字符 + ... + 后8字符
                if (fileName.length > 23) {
                  const prefix = fileName.substring(0, 12);
                  const suffix = fileName.substring(fileName.length - 8);
                  return (
                    <>
                      <div className="truncate">{prefix}</div>
                      <div className="truncate">...{suffix}</div>
                    </>
                  );
                } else {
                  return <div className="truncate">{fileName}</div>;
                }
              })()}
            </div>
          </div>
        )}
        
        {/* 🔥 文件来源标记 - 右下角圆点 */}
        {file.source && (
          <div className="absolute bottom-1 right-1" title={{
            'user_upload': '用户上传',
            'step_output': '执行输出',
            'edit': '编辑文件',
            'user_message': '消息文件'
          }[file.source]}>
            <div className={`w-2.5 h-2.5 rounded-full ${
              file.source === 'user_upload' ? 'bg-purple-500' : 
              file.source === 'step_output' ? 'bg-yellow-500' : 
              file.source === 'edit' ? 'bg-green-500' : 
              file.source === 'user_message' ? 'bg-blue-500' : 
              'bg-gray-500'
            } border border-white shadow-sm`} />
          </div>
        )}
        
        {/* 🔥 媒体类overlay */}
        {overlayType !== 'image' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
            <div className="bg-white bg-opacity-80 rounded-full p-1">
              <fileDisplayInfo.IconComponent size={16} className={fileDisplayInfo.colorClass} />
            </div>
          </div>
        )}
        
        {/* 🔥 上传进度指示器 */}
        <FileUploadProgress file={file} size={size} />

             
        {/* 紧凑模式下的文件名提示 */}
        {compact && (
          <div className="absolute -bottom-8 left-0 right-0 text-xs text-center text-gray-600 truncate px-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded shadow-sm z-10">
            {file.name}
          </div>
        )}
      </div>
      
      {/* 🔥 增强的媒体查看器 - 传递增强后的文件对象 */}
      <MediaViewer
        file={enhancedFile}
        isOpen={showMediaViewer}
        onClose={() => setShowMediaViewer(false)}
        conversationId={conversationId}
        snapshotId={snapshotId}
        onFileSave={(updatedFile) => {
          // 🔥 更新本地文件对象
          setEnhancedFile(updatedFile);
          // 向上传递保存通知
          if (onFileSave) {
            onFileSave(updatedFile);
          }
        }}
      />
    </>
  );
};

export default FilePreviewManager;