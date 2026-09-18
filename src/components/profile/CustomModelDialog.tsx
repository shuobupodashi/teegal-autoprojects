/**
 * 用户自定义模型配置弹窗组件（简化版）
 * 只需要：模型 ID、URL、API Key
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Edit2, AlertCircle, Eye, EyeOff, ExternalLink, Image as ImageIcon, MessageSquare, ImagePlus, Wand2, Video } from 'lucide-react';
// 🔥 视觉模型注册表与前后端共用（local-backend/src/shared/visionModels.ts 是唯一维护点）
import { detectVisionByModelId, isMediaGenerationModel, getMediaGenerationKind } from '../../../local-backend/src/shared/visionModels';
// 保持既有引用方（ModelSettings/OptimizedChatInput）import 路径不变
export { detectVisionByModelId, isMediaGenerationModel, getMediaGenerationKind };

/**
 * 🔥 模型分类图标（全应用统一）：每个模型显示标识其能力类型的图标
 * - 💬 MessageSquare 灰色：对话模型（可进主 loop）
 * - �+👁 MessageSquare+Image 蓝色叠加：对话模型 + 视觉理解（可进主 loop，支持图片输入）
 * - ✨ ImagePlus 橙色：图片生成（ReAct 工具调用）
 * - 🪄 Wand2 紫色：图片编辑（ReAct 工具调用）
 * - 🎬 Video 绿色：视频生成（ReAct 工具调用）
 */
export const ModelCategoryIcon: React.FC<{
  modelId: string;
  supportsVision?: boolean;
  className?: string;
}> = ({ modelId, supportsVision, className = 'h-3.5 w-3.5 shrink-0' }) => {
  const { t } = useTranslation();
  const kind = getMediaGenerationKind(modelId);
  if (kind === 'video') return <Video className={`${className} text-green-600`} aria-label={t('profile.customModelDialog.videoModel')} />;
  if (kind === 'image') return <ImagePlus className={`${className} text-orange-500`} aria-label={t('profile.customModelDialog.imageModel')} />;
  if (kind === 'image-edit') return <Wand2 className={`${className} text-purple-500`} aria-label={t('profile.customModelDialog.imageEditModel')} />;
  if (supportsVision || detectVisionByModelId(modelId)) {
    // 🔥 对话+视觉显示双图标：💬 标识对话身份，👁 蓝色小标叠加标识视觉能力（非互斥关系）
    return (
      <span className="relative inline-flex shrink-0" aria-label={t('profile.customModelDialog.visionChatModel')}>
        <MessageSquare className={`${className} text-gray-400`} />
        <ImageIcon className="absolute -top-1 -right-1 h-2.5 w-2.5 text-blue-500" />
      </span>
    );
  }
  return <MessageSquare className={`${className} text-gray-400`} aria-label={t('profile.customModelDialog.chatModel')} />;
};

// ============================================================================
// 🔥 常用模型配置
// ============================================================================

interface ModelPreset {
  id: string;
  name: string;
  vision?: boolean; // 🔥 是否支持多模态（图片输入）
  // 🔥 模型级端点覆盖：图片/视频等生成模型走专用端点（非 chat/completions），后端各 Service 依赖对应端点拼接
  url?: string;
}

interface ProviderPreset {
  provider: string;
  models: ModelPreset[];
  url: string;
  apiKeyUrl: string; // 开放平台 API Key 获取页面
}

const POPULAR_PROVIDERS: ProviderPreset[] = [
  {
    provider: 'Kimi (Moonshot)',
    models: [
      { id: 'kimi-k3', name: 'Kimi K3 (推荐, 1M上下文)' },
      { id: 'kimi-k2.7-code', name: 'Kimi K2.7 Code (编程专用)' },
      { id: 'kimi-k2.7-code-highspeed', name: 'Kimi K2.7 Code 高速版' },
      { id: 'kimi-k2.6', name: 'Kimi K2.6' },
      { id: 'kimi-k2.5', name: 'Kimi K2.5' },
    ],
    url: 'https://api.moonshot.cn/v1/chat/completions',
    apiKeyUrl: 'https://platform.moonshot.cn/console/api-keys',
  },
  {
    provider: 'DeepSeek',
    models: [
      { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash (推荐, 高性价比)' },
      { id: 'deepseek-v4-flash-vision-exp', name: 'DeepSeek V4 Flash Vision Exp (视觉理解)' },
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro (旗舰, 1M上下文)' },
    ],
    url: 'https://api.deepseek.com/v1/chat/completions',
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    provider: 'OpenAI',
    models: [
      { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol (最新旗舰)' },
      { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna' },
      { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra' },
    ],
    url: 'https://api.openai.com/v1/chat/completions',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
  },
  {
    provider: 'Qwen/百炼 (通义千问)',
    models: [
      { id: 'qwen3.8-max', name: 'Qwen 3.8 Max (最新旗舰)' },
      { id: 'qwen3.7-max', name: 'Qwen 3.7 Max' },
      { id: 'qwen-vl-max', name: 'Qwen VL Max (图片/视频理解)' },
      { id: 'qwen-vl-plus', name: 'Qwen VL Plus (图片理解, 高性价比)' },
      {
        id: 'qwen-image-edit',
        name: 'Qwen Image Edit (图片编辑)',
        url: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
      },
      {
        id: 'wanx2.1-imageedit',
        name: '万相 2.1 图片编辑',
        url: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
      },
      {
        id: 'wan2.5-t2v-preview',
        name: '万相 2.5 文生视频 (音画同步)',
        url: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
      },
      {
        id: 'wan2.5-i2v-preview',
        name: '万相 2.5 图生视频 (音画同步)',
        url: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
      },
    ],
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    apiKeyUrl: 'https://bailian.console.aliyun.com/#/api-key',
  },
  {
    // 🔥 火山方舟：豆包对话 / Seedance 视频 / Seed 生图，均为 OpenAI 兼容端点
    provider: '火山方舟 (豆包/Seedance)',
    models: [
      { id: 'doubao-seed-1.6', name: 'Doubao Seed 1.6 (旗舰对话)' },
      { id: 'doubao-seed-1.6-flash', name: 'Doubao Seed 1.6 Flash (高性价比)' },
      { id: 'doubao-seed-1.6-vision', name: 'Doubao Seed 1.6 Vision (视觉理解)' },
      {
        id: 'doubao-seededit-3.0-i2i',
        name: 'Doubao SeedEdit 3.0 (图片编辑)',
        // 后端 DoubaoImageService 在 base 后拼 /images/generations
        url: 'https://ark.cn-beijing.volces.com/api/v3',
      },
      {
        id: 'seedream-5.0',
        name: 'Seedream 5.0 (文/图生图)',
        // 后端 DoubaoImageService 在 base 后拼 /images/generations
        url: 'https://ark.cn-beijing.volces.com/api/v3',
      },
      {
        id: 'seedance-2.5',
        name: 'Seedance 2.5 (文/图生视频, 30秒4K)',
        // 后端 SeedanceVideoService 在 /contents/generations 后拼 /tasks
        url: 'https://ark.cn-beijing.volces.com/api/v3/contents/generations',
      },
    ],
    url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    apiKeyUrl: 'https://console.volcengine.com/ark',
  },
  {
    provider: 'GLM (智谱)',
    models: [
      { id: 'glm-5.3', name: 'GLM-5.3 (最新旗舰)' },
      { id: 'glm-5.2', name: 'GLM-5.2 (上一代旗舰)' },
      { id: 'glm-5.1', name: 'GLM-5.1' },
      { id: 'glm-5.0', name: 'GLM-5 (扎实好用)' },
    ],
    url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    apiKeyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
  },
  {
    provider: 'MiniMax',
    models: [
      { id: 'Minimax-M3', name: 'MiniMax M3 (多模态)' },
    ],
    url: 'https://api.minimaxi.com/v1/chat/completions',
    apiKeyUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key',
  },
  {
    provider: 'MiMo (小米)',
    models: [
      { id: 'mimo-v2.5-pro', name: 'MiMo V2.5 Pro (旗舰, 1M上下文, 推理增强)' },
      { id: 'mimo-v2.5', name: 'MiMo V2.5 (多模态)' },
    ],
    url: 'https://api.xiaomimimo.com/v1/chat/completions',
    apiKeyUrl: 'https://platform.xiaomimimo.com/#/console/api-keys',
  },
  {
    provider: 'OpenRouter',
    models: [
      { id: 'anthropic/claude-5.6-sonnet', name: 'Claude 5.6 Sonnet (旗舰)' },
      { id: 'openai/gpt-5.6-sol', name: 'GPT-5.6 Sol' },
      { id: 'google/gemini-3.2-pro', name: 'Gemini 3.2 Pro (多模态)' },
      { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
      { id: 'qwen/qwen3.8-max', name: 'Qwen 3.8 Max' },
      {
        id: 'google/veo-3.1',
        name: 'Veo 3.1 (视频, 音画同步)',
        // OpenRouter 视频/图片走专用端点（与 chat/completions 独立），后端 OpenRouterVideoService 直接 POST
        url: 'https://openrouter.ai/api/v1/videos',
      },
      {
        id: 'minimax/hailuo-3',
        name: 'Hailuo 3 (视频, 2K带音频)',
        url: 'https://openrouter.ai/api/v1/videos',
      },
      {
        id: 'bytedance-seed/seedream-4.5',
        name: 'Seedream 4.5 (文/图生图)',
        // 后端 OpenRouterImageService 直接 POST，响应 base64
        url: 'https://openrouter.ai/api/v1/images',
      },
      {
        id: 'openai/gpt-image-2',
        name: 'GPT Image 2 (文/图生图)',
        url: 'https://openrouter.ai/api/v1/images',
      },
    ],
    url: 'https://openrouter.ai/api/v1/chat/completions',
    apiKeyUrl: 'https://openrouter.ai/keys',
  },
  {
    provider: 'Anthropic',
    models: [
      { id: 'claude-5.6-sonnet', name: 'Claude 5.6 Sonnet (最新旗舰, 多模态)' },
      { id: 'claude-5.5-haiku', name: 'Claude 5.5 Haiku (快速, 多模态)' },
      { id: 'claude-5.4-opus', name: 'Claude 5.4 Opus (深度推理, 多模态)' },
    ],
    // 🔥 Anthropic 官方 OpenAI 兼容端点：标准 Bearer 认证，无需 x-api-key/anthropic-version 头
    url: 'https://api.anthropic.com/v1/chat/completions',
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
  },
];

// 🔥 VISION_MODEL_PREFIXES / VISION_MODEL_EXACT / detectVisionByModelId
// 已统一迁移至 local-backend/src/shared/visionModels.ts（前后端唯一维护点），顶部 import + re-export

export interface SimpleModelFormData {
  id?: string;
  modelId: string;
  url: string;
  apiKey: string;
  supportsVision?: boolean; // 🔥 是否支持多模态（图片输入）
}

export interface SimpleUserModel {
  id: string;
  name: string;
  modelId: string;
  url: string;
  apiKey: string;
  /** 🔥 套餐模型专用：云端 refreshToken（30天），local-backend 收到 401 时自动续期用 */
  refreshToken?: string;
  provider: string;
  requestFormat?: 'openai' | 'dashscope';
  supportsVision?: boolean; // 🔥 是否支持多模态（图片输入）
  isPackage?: boolean; // 🔥 套餐模型（走 home-web 代理，apiKey 为 JWT，不可配置）
  inputRate?: number;  // 🔥 套餐计费倍率（BE/百万输入token，展示用）
  outputRate?: number; // 🔥 套餐计费倍率（BE/百万输出token，展示用）
}

export interface SearchProviderConfig {
  id: string;
  name: string;
  type: 'search' | 'fetch';
  providerType: string;
  url: string;
  apiKey: string;
  apiKeyRequired?: boolean;
  requestTemplate?: {
    method: 'GET' | 'POST';
    authType: 'header' | 'query' | 'body' | 'none';
    authHeaderName?: string;
    authQueryParam?: string;
    queryTemplate?: string;
    bodyTemplate?: string;
  };
  responseTemplate?: {
    resultsPath: string;
    titlePath: string;
    urlPath: string;
    snippetPath: string;
  };
  keywords?: string[];
  description?: string;
  isGeneral?: boolean;
}

interface CustomModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingModel?: SimpleUserModel | null;
  existingModels: SimpleUserModel[];
  onSave: (model: SimpleModelFormData) => Promise<void>;
  isSystemModel?: boolean;
}

export const CustomModelDialog: React.FC<CustomModelDialogProps> = ({
  open,
  onOpenChange,
  editingModel,
  existingModels,
  onSave,
  isSystemModel = false,
}) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [formData, setFormData] = useState<SimpleModelFormData>({
    modelId: '',
    url: '',
    apiKey: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof SimpleModelFormData, string>>>({});
  // 🔥 Provider/Model 预设选择
  const [selectedProvider, setSelectedProvider] = useState<ProviderPreset | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelPreset | null>(null);
  // 🔥 用户是否手动指定过视觉能力：手动值优先，modelId 变化只更新未手动设置的
  const [visionManuallySet, setVisionManuallySet] = useState(false);

  useEffect(() => {
    if (open) {
      if (editingModel) {
        // 🔥 已存的 supportsVision 是用户意志，优先于自动检测
        const storedVision = editingModel.supportsVision;
        setFormData({
          id: editingModel.id,
          modelId: editingModel.modelId,
          url: editingModel.url,
          apiKey: editingModel.apiKey,
          supportsVision: storedVision ?? detectVisionByModelId(editingModel.modelId),
        });
        setVisionManuallySet(storedVision !== undefined);
      } else {
        setFormData({
          modelId: '',
          url: '',
          apiKey: '',
          supportsVision: false,
        });
        setVisionManuallySet(false);
        // 🔥 重置预设选择
        setSelectedProvider(null);
        setSelectedModel(null);
      }
      setErrors({});
      setShowApiKey(false);
    }
  }, [open, editingModel]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof SimpleModelFormData, string>> = {};

    // 系统模型只能修改 apiKey，其他字段不验证
    if (!isSystemModel) {
      if (!formData.modelId.trim()) {
        newErrors.modelId = '请输入模型 ID';
      } else {
        const modelIdExists = existingModels.some(
          m => m.modelId === formData.modelId && m.id !== formData.id
        );
        if (modelIdExists) {
          newErrors.modelId = '该模型 ID 已存在';
        }
      }

      if (!formData.url.trim()) {
        newErrors.url = '请输入 API URL';
      } else if (!formData.url.startsWith('http')) {
        newErrors.url = 'URL 必须以 http 或 https 开头';
      }
    }

    if (!formData.apiKey.trim()) {
      newErrors.apiKey = '请输入 API Key';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
      toast.success(editingModel ? t('profile.customModelDialog.modelUpdated') : t('profile.customModelDialog.modelAdded'));
      onOpenChange(false);
    } catch (error) {
      console.error('[CUSTOM-MODEL-DIALOG] 保存失败:', error);
      const msg = error instanceof Error ? error.message : t('profile.modelSettings.saveFailedRetry');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleModelIdChange = (modelId: string) => {
    // 🔥 输入 modelId 时自动检测多模态支持（用户手动设置过则不覆盖）
    const detected = detectVisionByModelId(modelId);
    setFormData(prev => ({
      ...prev,
      modelId,
      supportsVision: visionManuallySet ? prev.supportsVision : detected,
    }));
  };

  // 🔥 用户手动切换视觉能力：从此优先于自动检测
  const handleVisionToggle = (checked: boolean) => {
    setVisionManuallySet(true);
    setFormData(prev => ({ ...prev, supportsVision: checked }));
  };

  // 🔥 选择 Provider 后自动填充 URL，并重置 Model 选择（换服务商重置手动视觉标记）
  const handleProviderSelect = (provider: ProviderPreset) => {
    setSelectedProvider(provider);
    setSelectedModel(null);
    setVisionManuallySet(false);
    setFormData(prev => ({
      ...prev,
      url: provider.url,
      modelId: '', // 清空模型ID，等用户选择模型
      supportsVision: false,
    }));
  };

  // 🔥 选择 Model 后自动填充模型ID + 端点 + 同步 vision 标记
  const handleModelSelect = (model: ModelPreset) => {
    setSelectedModel(model);
    setFormData(prev => ({
      ...prev,
      modelId: model.id,
      // 🔥 模型级端点优先（图片/视频生成模型走专用端点），否则用 Provider 的 chat URL
      url: model.url || selectedProvider?.url || prev.url,
      // 🔥 优先用预设标记，否则按 modelId 检测（手动设置过则不覆盖）
      supportsVision: visionManuallySet ? prev.supportsVision : (model.vision ?? detectVisionByModelId(model.id)),
    }));
  };

  // 🔥 获取当前匹配的 Provider（用于显示 API Key 获取链接）
  const getCurrentProvider = (): ProviderPreset | null => {
    if (selectedProvider) return selectedProvider;
    // 根据 URL 匹配（含模型级端点覆盖）
    const currentUrl = formData.url;
    return POPULAR_PROVIDERS.find(
      p => p.url === currentUrl || p.models.some(m => m.url === currentUrl)
    ) || null;
  };

  // 🔥 打开开放平台 API Key 页面
  const handleOpenApiKeyPage = () => {
    const provider = getCurrentProvider();
    if (provider?.apiKeyUrl) {
      const electron = (window as any).electron;
      if (electron?.openExternal) {
        electron.openExternal(provider.apiKeyUrl);
      } else {
        window.open(provider.apiKeyUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  // 提取 URL 主体（域名）
  const extractUrlHost = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.toLowerCase();
    } catch {
      return '';
    }
  };

  // 从已有模型中查找相同 URL 主体的 API Key
  const findExistingApiKeyForUrl = (url: string): { apiKey: string; source: string } | null => {
    const targetHost = extractUrlHost(url);
    if (!targetHost) return null;

    for (const model of existingModels) {
      if (model.apiKey && extractUrlHost(model.url) === targetHost) {
        return { apiKey: model.apiKey, source: model.name };
      }
    }
    return null;
  };

  const handleAutoFillApiKey = (apiKey: string) => {
    setFormData(prev => ({ ...prev, apiKey }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSystemModel ? (
              <>
                <Edit2 className="h-5 w-5" />
                {t('profile.customModelDialog.configApiKey')}
              </>
            ) : editingModel ? (
              <>
                <Edit2 className="h-5 w-5" />
                {t('profile.customModelDialog.editModel')}
              </>
            ) : (
              <>
                <Plus className="h-5 w-5" />
                {t('profile.customModelDialog.addModel')}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-2">
          {isSystemModel && editingModel && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>{t('profile.customModelDialog.systemModelNote')}</strong>
              </p>
              <p className="text-xs text-blue-600 mt-1">
                {t('profile.customModelDialog.systemModelInfo', { name: editingModel.name, url: editingModel.url })}
              </p>
            </div>
          )}

          {!isSystemModel && (
            <>
              {/* 🔥 快速选择：Provider */}
              <div className="space-y-2 p-3 bg-blue-50/40 dark:bg-blue-950/20 rounded-lg border border-blue-100/60 dark:border-blue-900/30">
                <Label className="text-blue-600 dark:text-blue-400">{t('profile.customModelDialog.quickSelectProvider')}</Label>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_PROVIDERS.map((p) => (
                    <button
                      key={p.provider}
                      type="button"
                      onClick={() => handleProviderSelect(p)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                        selectedProvider?.provider === p.provider
                          ? 'bg-blue-100 border-blue-500 text-blue-700'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {p.provider}
                    </button>
                  ))}
                </div>
                {/* 🔥 选择服务商后，在同一区块内显示模型选择 */}
                {selectedProvider && (
                  <div className="space-y-2 pt-1">
                    <Label className="text-blue-600 dark:text-blue-400">{t('profile.customModelDialog.selectModel')}</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedProvider.models.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleModelSelect(m)}
                          className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                            selectedModel?.id === m.id
                              ? 'bg-green-100 border-green-500 text-green-700'
                              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="modelId">{t('profile.customModelDialog.modelIdLabel')}</Label>
                <Input
                  id="modelId"
                  placeholder={t('profile.customModelDialog.modelIdPlaceholder')}
                  value={formData.modelId}
                  onChange={(e) => handleModelIdChange(e.target.value)}
                  className={errors.modelId ? 'border-red-500' : ''}
                />
                {errors.modelId && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.modelId}
                  </p>
                )}
                {/* 🔥 视觉能力手动开关：自动识别作默认值，用户可覆盖（新模型无需等代码更新） */}
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer select-none pt-0.5">
                  <input
                    type="checkbox"
                    checked={!!formData.supportsVision}
                    onChange={(e) => handleVisionToggle(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300 accent-blue-500 cursor-pointer"
                  />
                  <span>{t('profile.customModelDialog.visionModel')}</span>
                  <span className="text-gray-400">
                    {visionManuallySet ? t('profile.customModelDialog.manuallySet') : `${t('profile.customModelDialog.autoDetect')}${detectVisionByModelId(formData.modelId) ? t('profile.customModelDialog.detected') : ''}`}
                  </span>
                </label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="url">{t('profile.customModelDialog.urlLabel')}</Label>
                <Input
                  id="url"
                  placeholder="https://api.example.com/v1/chat/completions"
                  value={formData.url}
                  onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                  className={errors.url ? 'border-red-500' : ''}
                />
                {errors.url && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.url}
                  </p>
                )}
              </div>
            </>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="apiKey">API Key *</Label>
              {/* 🔥 点击获取 API Key */}
              {getCurrentProvider() && (
                <button
                  type="button"
                  onClick={handleOpenApiKeyPage}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  点击获取 <ExternalLink className="h-3 w-3" />
                </button>
              )}
            </div>
            {/* 智能提示：相同 URL 主体的 API Key */}
            {(() => {
              const existingKeyInfo = !formData.apiKey && formData.url
                ? findExistingApiKeyForUrl(formData.url)
                : null;
              return existingKeyInfo ? (
                <button
                  type="button"
                  onClick={() => handleAutoFillApiKey(existingKeyInfo.apiKey)}
                  className="w-full text-left text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded transition-colors mb-1"
                >
                  <span className="font-medium">{t('profile.customModelDialog.reuseApiKey', { source: existingKeyInfo.source })}</span>
                </button>
              ) : null;
            })()}
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? 'text' : 'password'}
                placeholder="sk-xxxxxxxxxxxxxxxx"
                value={formData.apiKey}
                onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                className={errors.apiKey ? 'border-red-500 pr-10' : 'pr-10'}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.apiKey && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.apiKey}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('profile.customModelDialog.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('profile.customModelDialog.saving') : t('profile.customModelDialog.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
