import { 
  FileText, 
  FileImage, 
  File, 
  FileSpreadsheet,
  FileType,
  Music,
  Video,
  Archive,
  PlayCircle,
  VolumeX,
  Table
} from 'lucide-react';
import { FileAttachment } from '@/components/workspace/types/ChatTypes';

// 🔥 Simple cache to prevent redundant calculations
const fileTypeCache = new Map<string, { type: string; extension: string; confidence: number; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds

// 🔥 Cache key generator
const getCacheKey = (file: FileAttachment): string => {
  return `${file.id || file.name}-${file.type}-${file.content?.substring(0, 50) || ''}`;
};

// 🔥 Cache cleanup function
const cleanupCache = () => {
  const now = Date.now();
  for (const [key, value] of fileTypeCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      fileTypeCache.delete(key);
    }
  }
};

// Cleanup cache periodically
setInterval(cleanupCache, CACHE_DURATION);

/**
 * 从URL中分析文件类型
 */
export const analyzeUrlForFileType = (url: string): { type: string; extension: string; confidence: number } => {
  if (!url || typeof url !== 'string') {
    return { type: 'unknown', extension: '', confidence: 0 };
  }

  console.log('🔍 [FILE-TYPE-UTILS] 分析URL文件类型:', url.substring(0, 100));

  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    const hostname = urlObj.hostname.toLowerCase();
    const searchParams = urlObj.searchParams;
    
    // 1. 从路径中提取文件扩展名
    const pathExtMatch = pathname.match(/\.([a-z0-9]+)(?:\?|$)/i);
    if (pathExtMatch) {
      const ext = pathExtMatch[1].toLowerCase();
      const type = classifyFileByExtension(ext);
      if (type !== 'unknown') {
        console.log('✅ [FILE-TYPE-UTILS] 从路径扩展名识别:', { ext, type, confidence: 0.9 });
        return { type, extension: ext, confidence: 0.9 };
      }
    }

    // 2. 从URL参数中检测格式信息
    const formatParams = ['format', 'type', 'ext', 'extension', 'mime'];
    for (const param of formatParams) {
      const value = searchParams.get(param);
      if (value) {
        const type = classifyFileByExtension(value) || classifyFileByMimeType(value);
        if (type !== 'unknown') {
          console.log('✅ [FILE-TYPE-UTILS] 从URL参数识别:', { param, value, type, confidence: 0.8 });
          return { type, extension: value, confidence: 0.8 };
        }
      }
    }

    // 3. 从路径关键词检测
    const pathKeywords = {
      video: ['video', 'movie', 'film', 'media', 'stream', 'play', 'watch', 'mp4', 'avi', 'mov', 'webm', 'mkv'],
      image: ['image', 'img', 'pic', 'photo', 'picture', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
      audio: ['audio', 'music', 'sound', 'song', 'mp3', 'wav', 'ogg', 'flac'],
      document: ['doc', 'document', 'file', 'pdf', 'text', 'download']
    };

    for (const [type, keywords] of Object.entries(pathKeywords)) {
      if (keywords.some(keyword => pathname.includes(keyword) || hostname.includes(keyword))) {
        console.log('✅ [FILE-TYPE-UTILS] 从路径关键词识别:', { type, confidence: 0.7 });
        return { type, extension: getDefaultExtensionForType(type), confidence: 0.7 };
      }
    }

    // 4. 检测知名平台的URL模式
    const platformPatterns = {
      // 视频平台
      youtube: { patterns: ['youtube.com', 'youtu.be'], type: 'video', ext: 'mp4' },
      vimeo: { patterns: ['vimeo.com'], type: 'video', ext: 'mp4' },
      bilibili: { patterns: ['bilibili.com'], type: 'video', ext: 'mp4' },
      // 图片平台
      imgur: { patterns: ['imgur.com'], type: 'image', ext: 'jpg' },
      flickr: { patterns: ['flickr.com'], type: 'image', ext: 'jpg' },
      // 音频平台
      soundcloud: { patterns: ['soundcloud.com'], type: 'audio', ext: 'mp3' },
      // 文档平台
      googledrive: { patterns: ['drive.google.com'], type: 'document', ext: 'pdf' },
      dropbox: { patterns: ['dropbox.com'], type: 'document', ext: 'pdf' },
      // Coze和其他AI平台
      coze: { patterns: ['coze.cn', 'coze.com'], type: 'image', ext: 'jpg' },
      volcengine: { patterns: ['volcengineapi.com'], type: 'video', ext: 'mp4' }
    };

    for (const [platform, config] of Object.entries(platformPatterns)) {
      if (config.patterns.some(pattern => hostname.includes(pattern))) {
        console.log('✅ [FILE-TYPE-UTILS] 从平台模式识别:', { platform, type: config.type, confidence: 0.8 });
        return { type: config.type, extension: config.ext, confidence: 0.8 };
      }
    }

    // 5. 从路径中检测数据库文件
    const dbExtMatch = pathname.match(/\.(db|sqlite|sqlite3|parquet)(?:\?|$)/i);
    if (dbExtMatch) {
      const ext = dbExtMatch[1].toLowerCase();
      console.log('✅ [FILE-TYPE-UTILS] 从路径扩展名识别数据库文件:', { ext, confidence: 0.9 });
      return { type: 'database', extension: ext, confidence: 0.9 };
    }
    
    // 6. 默认推断（如果是HTTP/HTTPS URL）
    if (url.startsWith('http')) {
      console.log('⚠️ [FILE-TYPE-UTILS] 默认推断为未知文件');
      return { type: 'unknown', extension: 'bin', confidence: 0.1 };
    }

    console.log('❌ [FILE-TYPE-UTILS] 无法识别文件类型');
    return { type: 'unknown', extension: '', confidence: 0 };
  } catch (error) {
    console.error('❌ [FILE-TYPE-UTILS] URL解析失败:', error);
    return { type: 'unknown', extension: '', confidence: 0 };
  }
};

/**
 * 根据扩展名分类文件类型
 */
const classifyFileByExtension = (ext: string): string => {
  const extension = ext.toLowerCase().replace('.', '');
  
  const typeMap = {
    // 视频文件
    video: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v', '3gp', 'ogv', 'mpg', 'mpeg'],
    // 图片文件
    image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico', 'heic', 'avif'],
    // 音频文件
    audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus'],
    // 文档文件
    document: ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'odt'],
    // 表格文件
    spreadsheet: ['xls', 'xlsx', 'csv', 'ods'],
    // 数据库文件
    database: ['db', 'sqlite', 'sqlite3', 'parquet'],
    // 压缩文件
    archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2']
  };

  for (const [type, extensions] of Object.entries(typeMap)) {
    if (extensions.includes(extension)) {
      return type;
    }
  }

  return 'unknown';
};

/**
 * 根据MIME类型分类文件类型
 */
const classifyFileByMimeType = (mimeType: string): string => {
  const mime = mimeType.toLowerCase();
  
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.includes('pdf')) return 'document';
  if (mime.includes('document') || mime.includes('text')) return 'document';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'spreadsheet';
  if (mime.includes('zip') || mime.includes('archive')) return 'archive';
  if (mime.includes('sqlite') || mime.includes('x-sqlite3') || mime.includes('apache.parquet')) return 'database';
  
  return 'unknown';
};

/**
 * 获取类型的默认扩展名
 */
const getDefaultExtensionForType = (type: string): string => {
  const defaults = {
    video: 'mp4',
    image: 'jpg',
    audio: 'mp3',
    document: 'pdf',
    spreadsheet: 'xlsx',
    database: 'db',
    archive: 'zip'
  };
  
  return defaults[type as keyof typeof defaults] || 'bin';
};

/**
 * 增强的文件类型检测 - 带缓存优化
 */
export const detectFileType = (file: FileAttachment): { type: string; extension: string; confidence: number } => {
  // 🔥 Check cache first
  const cacheKey = getCacheKey(file);
  const cached = fileTypeCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    // 移除重复的日志，仅在调试时启用
    // console.log('🚀 [FILE-TYPE-UTILS] Using cached result for:', file.name);
    return { type: cached.type, extension: cached.extension, confidence: cached.confidence };
  }
  
  // 移除重复的日志，仅在调试时启用
  // console.log('🔍 [FILE-TYPE-UTILS] 检测文件类型:', { fileName: file.name, fileType: file.type });

  let result = { type: 'unknown', extension: '', confidence: 0 };

  // 1. 优先使用原有的MIME类型检测
  if (file.type && file.type !== 'application/octet-stream') {
    const type = classifyFileByMimeType(file.type);
    if (type !== 'unknown') {
      const ext = file.name.split('.').pop()?.toLowerCase() || getDefaultExtensionForType(type);
      // 移除重复的日志，仅在调试时启用
      // console.log('✅ [FILE-TYPE-UTILS] 从MIME类型识别:', { type, ext });
      result = { type, extension: ext, confidence: 0.9 };
    }
  }

  // 2. 从文件名扩展名检测
  if (result.type === 'unknown' && file.name) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext) {
      const type = classifyFileByExtension(ext);
      if (type !== 'unknown') {
        // 移除重复的日志，仅在调试时启用
        // console.log('✅ [FILE-TYPE-UTILS] 从文件名扩展名识别:', { type, ext });
        result = { type, extension: ext, confidence: 0.8 };
      }
    }
  }

  // 3. 从URL分析检测
  if (result.type === 'unknown') {
    const urlSource = file.content || file.url;
    if (urlSource && urlSource.startsWith('http')) {
      const urlResult = analyzeUrlForFileType(urlSource);
      if (urlResult.confidence > 0.5) {
        // 移除重复的日志，仅在调试时启用
        // console.log('✅ [FILE-TYPE-UTILS] 从URL分析识别:', urlResult);
        result = urlResult;
      }
    }
  }

  // 4. 🔥 兜底：基于文件名或URL后缀的图片识别（即便MIME不明确）
  if (result.type === 'unknown') {
    const nameLower = (file.name || '').toLowerCase();
    const urlSource = (file.content || file.url || '').toLowerCase();
    const imageExtRegex = /\.((jpg|jpeg|png|gif|webp|svg|bmp|tiff|heic|avif))(?:\?|$)/i;
    const isImageByName = imageExtRegex.test(nameLower);
    const isImageByUrl = imageExtRegex.test(urlSource);
    if (isImageByName || isImageByUrl) {
      const extMatch = nameLower.match(/\.([a-z0-9]+)$/) || urlSource.match(/\.([a-z0-9]+)(?:\?|$)/);
      const ext = extMatch ? extMatch[1] : 'jpg';
      // 移除重复的日志，仅在调试时启用
      // console.log('✅ [FILE-TYPE-UTILS] 兆底识别图片类型:', { ext });
      result = { type: 'image', extension: ext, confidence: 0.6 };
    }
  }

  // 🔥 Cache the result
  if (result.confidence > 0) {
    fileTypeCache.set(cacheKey, { ...result, timestamp: Date.now() });
  }

  return result;
};

// 保持原有函数的向后兼容性，但增强检测逻辑
export const getFileIcon = (file: FileAttachment) => {
  const { type, extension } = detectFileType(file);
  
  // 🔥 精细化图标映射：优先按具体文件类型（扩展名），再按大类
  // Excel/Spreadsheet
  if (['xlsx', 'xls', 'xlsm', 'csv', 'ods'].includes(extension)) {
    return Table; // 表格图标
  }
  
  // Markdown
  if (['md', 'markdown'].includes(extension)) {
    return FileText; // 文本图标
  }
  
  // 按大类返回图标
  switch (type) {
    case 'audio': return Music;
    case 'video': return Video;
    case 'image': return FileImage;
    case 'document': return FileType;
    case 'spreadsheet': return Table; // 改用 Table 图标
    case 'database': return FileType;
    case 'archive': return Archive;
    default: return File;
  }
};

export const getFileColor = (file: FileAttachment) => {
  const { type, extension } = detectFileType(file);
  
  // 🔥 精细化颜色映射：不同文件类型使用不同颜色
  // Excel 系列 - 绿色
  if (['xlsx', 'xls', 'xlsm', 'csv', 'ods'].includes(extension)) {
    return 'text-green-600';
  }
  
  // Markdown - 蓝色
  if (['md', 'markdown'].includes(extension)) {
    return 'text-blue-600';
  }
  
  // 其他 document - 红色
  if (type === 'document') {
    return 'text-red-600';
  }
  
  // 按大类返回颜色
  switch (type) {
    case 'audio': return 'text-orange-600';
    case 'video': return 'text-purple-600';
    case 'image': return 'text-green-600';
    case 'spreadsheet': return 'text-green-600';
    case 'database': return 'text-blue-600';
    case 'archive': return 'text-gray-600';
    default: return 'text-gray-500';
  }
};

export const getFileTypeLabel = (file: FileAttachment): string => {
  const { type, extension } = detectFileType(file);
  
  switch (type) {
    case 'audio': return 'AUDIO';
    case 'video': return 'VIDEO';
    case 'image': return 'IMAGE';
    case 'document': return 'DOC';
    case 'spreadsheet': return 'SHEET';
    case 'database': return 'DB';
    case 'archive': return 'ARCHIVE';
    default: return extension ? extension.toUpperCase() : 'FILE';
  }
};

// 增强的类型检测函数
export const isImage = (file: FileAttachment) => {
  const { type } = detectFileType(file);
  return type === 'image';
};

export const isVideo = (file: FileAttachment) => {
  const { type } = detectFileType(file);
  return type === 'video';
};

export const isAudio = (file: FileAttachment) => {
  const { type } = detectFileType(file);
  return type === 'audio';
};

export const hasImageData = (file: FileAttachment): boolean => {
  // 移除重复的日志，仅在调试时启用
  // console.log('🖼️ [FILE-TYPE-UTILS] Checking image data for:', file.name);
  
  // 🔥 广义图片判定：只要文件名/URL/数据URL能表明是图片，就认为是图片
  const nameLower = (file.name || '').toLowerCase();
  const urlSource = (file.content || file.url || '').toLowerCase();
  const imageExtRegex = /\.((jpg|jpeg|png|gif|webp|svg|bmp|tiff|heic|avif))(?:\?|$)/i;
  const isLikelyImage = isImage(file) 
    || imageExtRegex.test(nameLower) 
    || imageExtRegex.test(urlSource) 
    || (file.content?.startsWith('data:image/') || file.base64?.startsWith('data:image/') || file.preview?.startsWith('data:image/'));
  
  if (!isLikelyImage) {
    // 移除重复的日志，仅在调试时启用
    // console.log('❌ [FILE-TYPE-UTILS] Not an image file (broad check)');
    return false;
  }
  
  // 检查各种可能的数据源（按优先级：本地 > 内存 > OSS）
  const dataSources = [
    (file as any).localPath,    // 🔥 最优先：本地文件路径（Electron 本地存储模式）
    file.base64,                // 次优先：base64 内容
    file.content,               // 再次：content 字段（也是内存中的 base64）
    file.preview,
    file.originalBase64,
    file.thumbnailBase64,
    file.url,                   // 再次：url
    (file as any).storageUrl    // 最后：storageUrl（OSS 加载）
  ];
  
  for (const source of dataSources) {
    if (source && source.length > 0) {
      // 检查是否为有效的数据URL或HTTP URL
      if (source.startsWith('data:image/') || source.startsWith('http')) {
        console.log('✅ [FILE-TYPE-UTILS] Valid image data found');
        return true;
      }
    }
  }
  
  console.log('❌ [FILE-TYPE-UTILS] No valid image data found');
  return false;
};

export const getImageSource = (file: FileAttachment): string => {
  const localPath = (file as any).localPath;
  
  const sources = [
    file.base64,
    file.content,
    file.preview,
    file.originalBase64,
    file.thumbnailBase64,
    file.url,
    (file as any).storageUrl
  ];
  
  for (const source of sources) {
    if (source && source.length > 0) {
      if (source.startsWith('data:image/') || source.startsWith('http')) {
        return source;
      }
    }
  }
  
  // 🔥 修复：使用 file:// 协议访问本地文件（与 FileGrid.tsx 保持一致）
  if (localPath) {
    return `file://${localPath}`;
  }
  
  console.log('❌ [FILE-TYPE-UTILS] No valid image source found');
  return '';
};

export const getSizeClasses = (size: 'sm' | 'md' | 'lg') => {
  switch (size) {
    case 'sm': return 'w-16 h-16';
    case 'md': return 'w-24 h-24';
    case 'lg': return 'w-32 h-32';
    default: return 'w-24 h-24';
  }
};

export const getIconSizes = () => ({
  sm: 14,
  md: 20,
  lg: 28
});
