/**
 * DSE (Data Storage Environment) Panel
 * 🔥 云端文件面板 - 批量上传文件到云端，获取 URL 供训练代码引用
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, File, Copy, Check, Trash2, Loader2, FolderOpen, Image, FileText, Archive, Database, Plus, AtSign, Cloud, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { PRESET_DATASETS } from './presetDatasets';
import { CLOUD_API_BASE_URL } from '@/config/api';
import { CloudAuthService } from '@/services/cloud/CloudAuthService';

// 🔥 生产环境需要使用完整 URL，开发环境由 Vite 代理处理
// 🔥 本地后端 API 基址：开发走 vite proxy（/api/ecs-worker → local-backend，前缀会被剥掉），
// 生产直连 local-backend（3001），因此生产不能再带 /api/ecs-worker 前缀（否则 404）
const getApiBaseUrl = () => import.meta.env.DEV ? '/api/ecs-worker' : 'http://localhost:3001';

interface DSEFileRecord {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  oss_url: string;
  oss_path: string;
  local_path: string | null;
  dataset_id: string | null;
  dataset_name: string | null;
  created_at: number;
  updated_at: number;
}

interface DSEPanelProps {
  userId?: string;
  conversationId?: string | null;
}

/** 数据集展示项（服务端列表项；离线时由本地预设映射而来） */
interface DisplayDataset {
  id: string;
  nameZh: string;
  nameEn: string;
  descZh: string;
  descEn: string;
  category: 'pretrain' | 'sft' | 'domain';
  fileName: string;
  sizeBytes: number;
  /** 售价（BE，1:1 人民币）；0 = 免费 */
  priceBe: number;
  /** 已购/免费 → true */
  purchased: boolean;
  /** 付费未购时为 null（需先购买） */
  url: string | null;
}

// 文件类型判断
const getFileType = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) return 'image';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'zip';
  if (['csv', 'json', 'txt', 'md', 'xml'].includes(ext)) return 'csv';
  if (['pt', 'onnx', 'bin', 'h5', 'pth'].includes(ext)) return 'model';
  return 'other';
};

// MIME 类型映射
const getMimeType = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml',
    csv: 'text/csv', json: 'application/json', txt: 'text/plain',
    md: 'text/markdown', xml: 'text/xml', zip: 'application/zip',
    rar: 'application/x-rar-compressed', gz: 'application/gzip',
    pt: 'application/octet-stream', onnx: 'application/octet-stream',
    bin: 'application/octet-stream', h5: 'application/octet-stream',
    pth: 'application/octet-stream',
  };
  return mimeMap[ext] || 'application/octet-stream';
};

const DSEPanel: React.FC<DSEPanelProps> = ({ userId, conversationId }) => {
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const isZh = (i18n.language || 'zh').startsWith('zh');
  const [files, setFiles] = useState<DSEFileRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // 🔥 服务端数据集列表（与套餐模型同款模式：上下架/调价无需发版）；null = 拉取失败，回退本地预设
  const [serverDatasets, setServerDatasets] = useState<DisplayDataset[] | null>(null);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  // 拉取服务端数据集列表（带 JWT 时附带购买状态；失败回退本地预设）
  useEffect(() => {
    let cancelled = false;
    const loadDatasets = async () => {
      try {
        const headers: Record<string, string> = {};
        const token = CloudAuthService.getAccessToken();
        if (token) headers.Authorization = `Bearer ${token}`;
        const resp = await fetch(`${CLOUD_API_BASE_URL}/datasets`, { headers, signal: AbortSignal.timeout(5000) });
        if (!resp.ok) return;
        const data = await resp.json();
        if (!cancelled && data.success && Array.isArray(data.datasets)) {
          setServerDatasets(data.datasets);
        }
      } catch {
        // 离线或服务不可用：保持 null，走本地预设回退
      }
    };
    loadDatasets();
    // 登录态变化后刷新（购买状态依赖 JWT）
    window.addEventListener('cloud-auth-changed', loadDatasets as EventListener);
    return () => {
      cancelled = true;
      window.removeEventListener('cloud-auth-changed', loadDatasets as EventListener);
    };
  }, []);

  // 展示列表：服务端优先，离线回退本地预设（本地预设视为免费可用）
  const datasets: DisplayDataset[] = serverDatasets ?? PRESET_DATASETS.map(p => ({
    ...p,
    priceBe: 0,
    purchased: true,
  }));

  // 加载已有文件
  useEffect(() => {
    if (userId) loadFiles();
  }, [userId]);

  const loadFiles = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const resp = await fetch(`${getApiBaseUrl()}/api/local/dse-files?user_id=${userId}&limit=200`);
      if (resp.ok) {
        const data = await resp.json();
        setFiles(data);
      }
    } catch {
      // 忽略加载错误
    }
    setLoading(false);
  };

  // 格式化文件大小
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // 获取文件图标
  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'image': return <Image className="w-4 h-4 text-blue-500" />;
      case 'zip': return <Archive className="w-4 h-4 text-yellow-500" />;
      case 'csv': return <FileText className="w-4 h-4 text-green-500" />;
      case 'model': return <File className="w-4 h-4 text-purple-500" />;
      default: return <File className="w-4 h-4 text-gray-400" />;
    }
  };

  // 上传单个文件到 OSS + 保存记录到 DB
  const uploadFile = async (localPath: string): Promise<DSEFileRecord | null> => {
    const electron = (window as any).electron;
    if (!electron) return null;

    try {
      const readResult = await electron.readLocalFile({ localPath });
      if (!readResult.success) {
        console.warn(`[DSE] 读取失败: ${localPath} - ${readResult.error}`);
        return null;
      }

      const fileName = localPath.split(/[/\\]/).pop() || 'file';
      const mimeType = getMimeType(fileName);
      const fileType = getFileType(fileName);
      const base64Content = readResult.content;
      const dataUrl = `data:${mimeType};base64,${base64Content}`;

      const { StorageFactory } = await import('@/utils/storage/StorageFactory');
      const storageProvider = StorageFactory.getDefaultProvider();

      const ossPath = `dse/${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${fileName}`;
      const uploadResult = await storageProvider.upload(
        'uploaded-files',
        ossPath,
        dataUrl,
        { contentType: mimeType, upsert: false }
      );

      if (!uploadResult.success || !uploadResult.url) {
        console.warn(`[DSE] 上传失败: ${fileName} - ${uploadResult.error}`);
        return null;
      }

      const fileSize = Math.ceil((base64Content.length * 3) / 4);

      // 保存到后端 DB
      const dbResp = await fetch(`${getApiBaseUrl()}/api/local/dse-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          file_name: fileName,
          file_size: fileSize,
          file_type: fileType,
          oss_url: uploadResult.url,
          oss_path: ossPath,
          local_path: localPath,
        }),
      });

      if (dbResp.ok) {
        return await dbResp.json();
      }

      // DB 保存失败但 OSS 上传成功，仍返回记录
      return {
        id: `tmp-${Date.now()}`,
        file_name: fileName,
        file_size: fileSize,
        file_type: fileType,
        oss_url: uploadResult.url,
        oss_path: ossPath,
        local_path: localPath,
        dataset_id: null,
        dataset_name: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      };
    } catch (err) {
      console.warn(`[DSE] 上传异常: ${localPath} - ${err}`);
      return null;
    }
  };

  // 批量上传
  const handleUpload = useCallback(async (filePaths: string[]) => {
    if (filePaths.length === 0) return;
    setUploading(true);
    setUploadProgress({ current: 0, total: filePaths.length });

    const results: DSEFileRecord[] = [];
    let failed = 0;

    for (let i = 0; i < filePaths.length; i++) {
      setUploadProgress({ current: i + 1, total: filePaths.length });
      const result = await uploadFile(filePaths[i]);
      if (result) {
        results.push(result);
      } else {
        failed++;
      }
    }

    setFiles(prev => [...results, ...prev]);
    setUploading(false);

    if (results.length > 0) {
      toast({
        title: t('workspace.desktopModule.dsePanel.uploadComplete', {
          count: results.length,
          failed: failed > 0 ? t('workspace.desktopModule.dsePanel.uploadCompleteFailed', { count: failed }) : '',
        }),
      });
    } else {
      toast({ title: t('workspace.desktopModule.dsePanel.uploadAllFailed'), variant: 'destructive' });
    }
  }, [userId, t]);

  // 选择文件
  const handleSelectFiles = async () => {
    const electron = (window as any).electron;
    if (!electron?.showOpenDialog) {
      toast({ title: t('workspace.desktopModule.dsePanel.desktopOnly'), variant: 'destructive' });
      return;
    }

    try {
      const result = await electron.showOpenDialog({
        properties: ['multiSelections', 'openFile'],
        title: t('workspace.desktopModule.dsePanel.selectDialogTitle'),
      });

      if (!result.canceled && result.filePaths?.length > 0) {
        handleUpload(result.filePaths);
      }
    } catch (err) {
      toast({ title: t('workspace.desktopModule.dsePanel.selectFailed'), variant: 'destructive' });
    }
  };

  // 选择目录
  const handleSelectFolder = async () => {
    const electron = (window as any).electron;
    if (!electron?.showOpenDialog) {
      toast({ title: t('workspace.desktopModule.dsePanel.desktopOnly'), variant: 'destructive' });
      return;
    }

    try {
      const result = await electron.showOpenDialog({
        properties: ['openDirectory'],
        title: t('workspace.desktopModule.dsePanel.selectFolderTitle'),
      });

      if (result.canceled || !result.filePaths?.length) return;

      const dirPath = result.filePaths[0];
      const dirResult = await electron.readDirectory(dirPath);

      if (dirResult.success && dirResult.files?.length > 0) {
        const filePaths = dirResult.files
          .filter((f: any) => f.type === 'file')
          .map((f: any) => f.path)
          .slice(0, 200);

        if (filePaths.length > 0) {
          handleUpload(filePaths);
        } else {
          toast({ title: t('workspace.desktopModule.dsePanel.dirEmpty'), variant: 'destructive' });
        }
      } else {
        toast({ title: t('workspace.desktopModule.dsePanel.readDirFailed'), variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: t('workspace.desktopModule.dsePanel.folderSelectFailed'), variant: 'destructive' });
    }
  };

  // 复制 URL
  const copyUrl = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 复制所有 URL
  const copyAllUrls = async () => {
    const urls = files.map(f => `${f.file_name}: ${f.oss_url}`).join('\n');
    await navigator.clipboard.writeText(urls);
    toast({ title: t('workspace.desktopModule.dsePanel.copiedUrls', { count: files.length }) });
  };

  // 删除文件
  const removeFile = async (id: string) => {
    try {
      await fetch(`${getApiBaseUrl()}/api/local/dse-files/${id}`, { method: 'DELETE' });
      setFiles(prev => prev.filter(f => f.id !== id));
    } catch {
      toast({ title: t('workspace.desktopModule.dsePanel.deleteFailed'), variant: 'destructive' });
    }
  };

  // 🔥 添加到对话：把数据集以 @ 引用形式插入聊天输入框（用户可接着写自己的指令）
  const handleBuildModel = (file: DSEFileRecord) => {
    window.dispatchEvent(new CustomEvent('insertDatasetReference', {
      detail: { fileName: file.file_name, ossUrl: file.oss_url },
    }));
  };

  // 添加数据集：免费/已购直接入列表；付费未购先走购买（扣余额）再入列表
  const addPresetDataset = async (preset: DisplayDataset) => {
    if (!userId) return;
    try {
      let url = preset.url;

      // 🔥 付费未购：先购买（服务端校验余额 + 扣费 + 记录 dataset_purchases，返回真实 URL）
      if (preset.priceBe > 0 && !preset.purchased) {
        const token = CloudAuthService.getAccessToken();
        if (!token) {
          toast({ title: t('workspace.desktopModule.dsePanel.purchaseLoginRequired'), variant: 'destructive' });
          return;
        }
        const confirmed = window.confirm(
          t('workspace.desktopModule.dsePanel.purchaseConfirm', {
            name: isZh ? preset.nameZh : preset.nameEn,
            price: preset.priceBe,
          })
        );
        if (!confirmed) return;

        setPurchasingId(preset.id);
        try {
          const resp = await fetch(`${CLOUD_API_BASE_URL}/datasets/${preset.id}/purchase`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await resp.json();
          if (!resp.ok || !data.success || !data.url) {
            toast({ title: data.error || t('workspace.desktopModule.dsePanel.purchaseFailed'), variant: 'destructive' });
            return;
          }
          url = data.url;
          // 本地标记已购，刷新按钮状态
          setServerDatasets(prev => prev?.map(d => (d.id === preset.id ? { ...d, purchased: true, url: data.url } : d)) ?? prev);
          toast({ title: t('workspace.desktopModule.dsePanel.purchaseSuccess', { price: preset.priceBe }) });
        } finally {
          setPurchasingId(null);
        }
      }

      if (!url) return;
      // 🔥 file_type 按文件后缀推断（YOLO 数据集是 zip，不能写死 csv，否则 list_cloud_files(file_type=...) 过滤会漏）
      const lowerName = preset.fileName.toLowerCase();
      const ext = lowerName.split('.').pop() || '';
      const fileTypeMap: Record<string, string> = {
        zip: 'zip', csv: 'csv', jsonl: 'jsonl', json: 'json',
        parquet: 'parquet', txt: 'txt', pth: 'pth', pt: 'pt',
        png: 'image', jpg: 'image', jpeg: 'image',
      };
      const resp = await fetch(`${getApiBaseUrl()}/api/local/dse-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          file_name: preset.fileName,
          file_size: preset.sizeBytes,
          file_type: fileTypeMap[ext] || 'file',
          oss_url: url,
          oss_path: '',
          local_path: null,
        }),
      });
      if (resp.ok) {
        const record = await resp.json();
        setFiles(prev => [record, ...prev]);
        toast({ title: t('workspace.desktopModule.dsePanel.presetAddSuccess', { name: preset.fileName }) });
      } else {
        toast({ title: t('workspace.desktopModule.dsePanel.presetAddFailed'), variant: 'destructive' });
      }
    } catch {
      toast({ title: t('workspace.desktopModule.dsePanel.presetAddFailed'), variant: 'destructive' });
    }
  };

  // 拖拽处理
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const electron = (window as any).electron;
    if (electron) {
      const items = e.dataTransfer.files;
      if (items.length > 0) {
        const paths: string[] = [];
        for (let i = 0; i < items.length; i++) {
          const path = (items[i] as any).path;
          if (path) paths.push(path);
        }
        if (paths.length > 0) handleUpload(paths);
      }
    }
  };

  const totalSize = files.reduce((sum, f) => sum + f.file_size, 0);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* 官方数据集：服务端托管（上下架/调价无需发版），离线回退本地预设。
          🔥 独立滚动（约 6 条高度）：条目多了往后要加分页/搜索，先保证不撑爆面板 */}
      <div className="mx-3 mt-3 shrink-0">
        <div className="flex items-center gap-1 mb-1">
          <Database className="w-3 h-3 text-gray-400" />
          <span className="text-xs font-medium text-gray-600">{t('workspace.desktopModule.dsePanel.presetDatasets')}</span>
          {serverDatasets ? (
            <Cloud className="w-3 h-3 text-emerald-500" />
          ) : (
            <span className="text-[9px] text-gray-400">{t('workspace.desktopModule.dsePanel.offlineFallback')}</span>
          )}
        </div>
        <div className="space-y-0.5 max-h-[264px] overflow-y-auto">
          {datasets.map((preset) => {
            // 按文件名判重（付费未购时 url 为 null，不能用 url 匹配）
            const added = files.some(f => f.file_name === preset.fileName);
            const purchasing = purchasingId === preset.id;
            return (
              <div key={preset.id} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-gray-50">
                <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{isZh ? preset.nameZh : preset.nameEn}</p>
                  <p className="text-[10px] text-gray-400 truncate">{isZh ? preset.descZh : preset.descEn} · {formatSize(preset.sizeBytes)}</p>
                </div>
                <span className={`text-[9px] px-1 py-0.5 rounded shrink-0 ${preset.category === 'pretrain' ? 'bg-blue-50 text-blue-500' : preset.category === 'sft' ? 'bg-purple-50 text-purple-500' : 'bg-emerald-50 text-emerald-600'}`}>
                  {t(preset.category === 'pretrain'
                    ? 'workspace.desktopModule.dsePanel.presetCategoryPretrain'
                    : preset.category === 'sft'
                      ? 'workspace.desktopModule.dsePanel.presetCategorySft'
                      : 'workspace.desktopModule.dsePanel.presetCategoryDomain')}
                </span>
                {/* 价格：免费=灰，付费未购=琥珀色，已购=绿 */}
                {preset.priceBe > 0 ? (
                  <span className={`text-[9px] font-medium shrink-0 ${preset.purchased ? 'text-green-600' : 'text-amber-600'}`}>
                    {preset.purchased ? t('workspace.desktopModule.dsePanel.purchased') : <span className="inline-flex items-center gap-0.5"><Sparkles className="h-2.5 w-2.5" />{preset.priceBe}</span>}
                  </span>
                ) : (
                  <span className="text-[9px] text-gray-400 shrink-0">{t('workspace.desktopModule.dsePanel.priceFree')}</span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addPresetDataset(preset)}
                  disabled={added || !userId || purchasing}
                  className={`h-5 px-1.5 text-[10px] shrink-0 ${preset.priceBe > 0 && !preset.purchased ? 'text-amber-600 border-amber-300 hover:bg-amber-50' : ''}`}
                  title={added
                    ? t('workspace.desktopModule.dsePanel.presetAdded')
                    : preset.priceBe > 0 && !preset.purchased
                      ? t('workspace.desktopModule.dsePanel.purchaseAdd', { price: preset.priceBe })
                      : t('workspace.desktopModule.dsePanel.presetAdd')}
                >
                  {purchasing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : added ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <Plus className="w-3 h-3" />
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 上传区域（自有数据：不用官方数据集也可以用自己的） */}
      <div
        className={`mx-3 mt-3 shrink-0 border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
          dragOver ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:border-emerald-400 hover:bg-gray-50'
        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={handleSelectFiles}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-sm text-gray-600">{t('workspace.desktopModule.dsePanel.uploading', uploadProgress)}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-gray-400" />
            <p className="text-sm text-gray-600">{t('workspace.desktopModule.dsePanel.dropToUpload')}</p>
            <p className="text-xs text-gray-400">{t('workspace.desktopModule.dsePanel.supportedTypes')}</p>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="mx-3 mt-2 shrink-0 flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleSelectFolder} disabled={uploading} className="flex-1">
          <FolderOpen className="w-3.5 h-3.5 mr-1" />
          {t('workspace.desktopModule.dsePanel.selectFolder')}
        </Button>
        <Button variant="outline" size="sm" onClick={handleSelectFiles} disabled={uploading} className="flex-1">
          <Upload className="w-3.5 h-3.5 mr-1" />
          {t('workspace.desktopModule.dsePanel.selectFiles')}
        </Button>
      </div>

      {/* 文件列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : files.length > 0 ? (
        <div className="mt-3 px-3 shrink-0">
          {/* 统计和操作 */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">
              {t('workspace.desktopModule.dsePanel.fileStats', { count: files.length, size: formatSize(totalSize) })}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={copyAllUrls} className="h-6 px-2 text-xs">
                {t('workspace.desktopModule.dsePanel.copyAllUrls')}
              </Button>
            </div>
          </div>

          {/* 文件列表 */}
          <div className="space-y-1">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-50 group"
              >
                {getFileIcon(file.file_type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.file_name}</p>
                  <p className="text-xs text-gray-400 truncate">{formatSize(file.file_size)}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBuildModel(file)}
                    className="h-6 w-6 p-0 text-emerald-600 hover:text-emerald-700"
                    title={t('workspace.desktopModule.dsePanel.addToConversation')}
                  >
                    <AtSign className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyUrl(file.oss_url, file.id)}
                    className="h-6 w-6 p-0"
                    title={t('workspace.desktopModule.dsePanel.copyUrl')}
                  >
                    {copiedId === file.id ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(file.id)}
                    className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                    title={t('workspace.desktopModule.dsePanel.delete')}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center py-8 text-gray-400 shrink-0">
          <div className="text-center">
            <p className="text-sm">{t('workspace.desktopModule.dsePanel.noFiles')}</p>
            <p className="text-xs mt-1">{t('workspace.desktopModule.dsePanel.noFilesHint')}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DSEPanel;
