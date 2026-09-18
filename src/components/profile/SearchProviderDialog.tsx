/**
 * 搜索源配置弹窗组件
 * 配置搜索和爬取服务
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Edit2, AlertCircle, Eye, EyeOff, Search, Globe, Sparkles, BookOpen, ExternalLink } from 'lucide-react';

// 预设搜索源配置
const PRESET_PROVIDERS = {
  huggingface: {
    name: 'HuggingFace 模型搜索',
    type: 'search' as const,
    url: 'https://huggingface.co/api/models',
    providerType: 'huggingface',
    description: '搜索 HuggingFace 上的开源 AI 模型',
    icon: <Sparkles className="h-4 w-4 text-yellow-500" />,
    apiKeyRequired: false,
    apiKeyUrl: undefined as string | undefined,
  },
  arxiv: {
    name: 'arXiv 学术论文',
    type: 'search' as const,
    url: 'http://export.arxiv.org/api/query',
    providerType: 'arxiv',
    description: '搜索 arXiv 上的学术论文',
    icon: <BookOpen className="h-4 w-4 text-red-500" />,
    apiKeyRequired: false,
    apiKeyUrl: undefined as string | undefined,
  },
  tavily: {
    name: 'Tavily Search',
    type: 'search' as const,
    url: 'https://api.tavily.com/search',
    providerType: 'tavily',
    description: '高质量 AI 搜索引擎',
    icon: <Search className="h-4 w-4 text-blue-500" />,
    apiKeyRequired: true,
    apiKeyUrl: 'https://app.tavily.com/',
  },
  serpapi: {
    name: 'SerpAPI (Google)',
    type: 'search' as const,
    url: 'https://serpapi.com/search',
    providerType: 'serpapi',
    description: 'Google 搜索结果 API',
    icon: <Search className="h-4 w-4 text-green-500" />,
    apiKeyRequired: true,
    apiKeyUrl: 'https://serpapi.com/manage-api-key',
  },
  bing: {
    name: 'Bing Search',
    type: 'search' as const,
    url: 'https://api.bing.microsoft.com/v7.0/search',
    providerType: 'bing',
    description: '微软必应搜索 API',
    icon: <Search className="h-4 w-4 text-blue-600" />,
    apiKeyRequired: true,
    apiKeyUrl: 'https://www.microsoft.com/bing/apis/bing-web-search-api',
  },
};

export interface SearchProviderFormData {
  id?: string;
  name: string;
  type: 'search' | 'fetch';
  url: string;
  apiKey: string;
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

interface SearchProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProvider?: SearchProviderConfig | null;
  existingProviders: SearchProviderConfig[];
  onSave: (provider: SearchProviderFormData) => Promise<void>;
}

export const SearchProviderDialog: React.FC<SearchProviderDialogProps> = ({
  open,
  onOpenChange,
  editingProvider,
  existingProviders,
  onSave,
}) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [formData, setFormData] = useState<SearchProviderFormData>({
    name: '',
    type: 'search',
    url: '',
    apiKey: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof SearchProviderFormData, string>>>({});

  useEffect(() => {
    if (open) {
      if (editingProvider) {
        setFormData({
          id: editingProvider.id,
          name: editingProvider.name,
          type: editingProvider.type,
          url: editingProvider.url,
          apiKey: editingProvider.apiKey,
        });
      } else {
        setFormData({
          name: '',
          type: 'search',
          url: '',
          apiKey: '',
        });
      }
      setErrors({});
      setShowApiKey(false);
    }
  }, [open, editingProvider]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof SearchProviderFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = '请输入搜索源名称';
    } else {
      const nameExists = existingProviders.some(
        p => p.name === formData.name && p.id !== formData.id
      );
      if (nameExists) {
        newErrors.name = '该名称已存在';
      }
    }

    if (!formData.url.trim()) {
      newErrors.url = '请输入 API URL';
    } else if (!formData.url.startsWith('http')) {
      newErrors.url = 'URL 必须以 http 或 https 开头';
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
      toast.success(editingProvider ? t('profile.searchProviderDialog.providerUpdated') : t('profile.searchProviderDialog.providerAdded'));
      onOpenChange(false);
    } catch (error) {
      console.error('[SEARCH-PROVIDER-DIALOG] 保存失败:', error);
      toast.error(t('profile.modelSettings.saveFailedRetry'));
    } finally {
      setSaving(false);
    }
  };

  const typeIcons = {
    search: <Search className="h-4 w-4" />,
    fetch: <Globe className="h-4 w-4" />,
  };

  const typeLabels = {
    search: '搜索引擎',
    fetch: '网页爬取',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editingProvider ? (
              <>
                <Edit2 className="h-5 w-5" />
                编辑搜索源
              </>
            ) : (
              <>
                <Plus className="h-5 w-5" />
                添加搜索源
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* 预设搜索源选择（仅添加时显示） */}
          {!editingProvider && (
            <div className="space-y-2">
              <Label>{t('profile.searchProviderDialog.quickPresets')}</Label>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(PRESET_PROVIDERS).map(([key, preset]) => (
                  <div
                    key={key}
                    onClick={() => {
                      setFormData({
                        name: preset.name,
                        type: preset.type,
                        url: preset.url,
                        apiKey: '',
                      });
                    }}
                    className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left cursor-pointer"
                  >
                    <div className="mt-0.5">{preset.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{preset.name}</div>
                      <div className="text-xs text-muted-foreground">{preset.description}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {!preset.apiKeyRequired && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700">
                            免 API Key
                          </span>
                        )}
                        {preset.apiKeyUrl && (
                          <a
                            href={preset.apiKeyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" />
                            获取 API Key
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">{t('profile.searchProviderDialog.orManual')}</span>
                </div>
              </div>
            </div>
          )}

          {/* 类型选择 */}
          <div className="space-y-2">
            <Label htmlFor="type">{t('profile.searchProviderDialog.typeLabel')}</Label>
            <Select
              value={formData.type}
              onValueChange={(value: 'search' | 'fetch') =>
                setFormData(prev => ({ ...prev, type: value }))
              }
            >
              <SelectTrigger id="type">
                <SelectValue placeholder={t('profile.searchProviderDialog.selectType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="search" className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    搜索引擎
                  </div>
                </SelectItem>
                <SelectItem value="fetch" className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    url阅读
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('profile.searchProviderDialog.typeHint')}
            </p>
          </div>

          {/* 名称 */}
          <div className="space-y-2">
            <Label htmlFor="name">
              名称
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('profile.searchProviderDialog.namePlaceholder', { example: formData.type === 'search' ? 'Tavily Search' : 'Firecrawl Fetch' })}
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <div className="flex items-center gap-1 text-red-500 text-sm">
                <AlertCircle className="h-4 w-4" />
                {errors.name}
              </div>
            )}
          </div>

          {/* URL */}
          <div className="space-y-2">
            <Label htmlFor="url">
              API URL
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <Input
              id="url"
              value={formData.url}
              onChange={e => setFormData(prev => ({ ...prev, url: e.target.value }))}
              placeholder={formData.type === 'search' 
                ? 'https://api.tavily.com/search' 
                : 'https://api.firecrawl.dev/v0/scrape'}
              className={errors.url ? 'border-red-500' : ''}
            />
            {errors.url && (
              <div className="flex items-center gap-1 text-red-500 text-sm">
                <AlertCircle className="h-4 w-4" />
                {errors.url}
              </div>
            )}
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? 'text' : 'password'}
                value={formData.apiKey}
                onChange={e => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder={t('profile.searchProviderDialog.apiKeyOptional')}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {(() => {
              const preset = Object.values(PRESET_PROVIDERS).find(p => p.url === formData.url);
              return preset?.apiKeyUrl ? (
                <a
                  href={preset.apiKeyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {t('profile.searchProviderDialog.goGetApiKey')}
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t('profile.searchProviderDialog.emptyMeansDisabled')}
                </p>
              );
            })()}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('profile.searchProviderDialog.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('profile.searchProviderDialog.saving') : editingProvider ? t('profile.searchProviderDialog.save') : t('profile.searchProviderDialog.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SearchProviderDialog;
