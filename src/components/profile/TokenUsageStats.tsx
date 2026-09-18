import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, BarChart3, Clock, TrendingUp, Zap, ChevronDown, ChevronUp, Layers, Brain } from 'lucide-react';
import { getBackendUrl } from '@/config/api';

interface TokenUsageRecord {
  timestamp: string;
  source: 'react' | 'summary';
  model: string;
  promptTokens: number;
  completionTokens: number;      // 总输出（含 reasoning）
  reasoningTokens?: number;      // 推理思考 token（被丢弃）
  outputTokens?: number;         // 实际输出 = completion - reasoning
  totalTokens: number;
  duration?: number;
  sessionId?: string;
  depth?: number;
}

interface DailyTokenUsage {
  date: string;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalReasoningTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalDuration: number;
  callCount: number;
  records: TokenUsageRecord[];
}

interface ModelPerformanceStats {
  model: string;
  totalCalls: number;
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalReasoningTokens: number;
  totalOutputTokens: number;
  totalDuration: number;
  avgDuration: number;
  avgPromptTokens: number;
  avgCompletionTokens: number;
  avgReasoningTokens: number;
  avgOutputTokens: number;
  reasoningRatio: number;        // 推理占比 = reasoning / completion
  tokensPerSecond: number;
  depthStats?: DepthPerformanceStats[];
}

interface DepthPerformanceStats {
  depth: number;
  callCount: number;
  avgDuration: number;
  avgPromptTokens: number;
  avgCompletionTokens: number;
  avgReasoningTokens: number;
  avgOutputTokens: number;
  avgTotalTokens: number;
  tokensPerSecond: number;
}

interface TokenUsageStatsProps {
  userId: string;
}

export function TokenUsageStats({ userId }: TokenUsageStatsProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [recentUsage, setRecentUsage] = useState<DailyTokenUsage[]>([]);
  const [modelStats, setModelStats] = useState<ModelPerformanceStats[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  useEffect(() => {
    loadTokenUsage();
  }, [userId]);

  const loadTokenUsage = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${getBackendUrl()}/api/llm-models/token-usage/recent?days=7`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setRecentUsage(result.data);
          calculateModelStats(result.data);
        }
      }
    } catch (error) {
      console.error('[TokenUsageStats] 加载 token 使用量失败:', error);
    }
    setLoading(false);
  };

  const calculateModelStats = (dailyUsages: DailyTokenUsage[]) => {
    const modelMap: Record<string, ModelPerformanceStats> = {};

    dailyUsages.forEach(day => {
      day.records.forEach(record => {
        if (!record.duration) return;

        if (!modelMap[record.model]) {
          modelMap[record.model] = {
            model: record.model,
            totalCalls: 0,
            totalTokens: 0,
            totalPromptTokens: 0,
            totalCompletionTokens: 0,
            totalReasoningTokens: 0,
            totalOutputTokens: 0,
            totalDuration: 0,
            avgDuration: 0,
            avgPromptTokens: 0,
            avgCompletionTokens: 0,
            avgReasoningTokens: 0,
            avgOutputTokens: 0,
            reasoningRatio: 0,
            tokensPerSecond: 0,
            depthStats: [],
          };
        }

        modelMap[record.model].totalCalls += 1;
        modelMap[record.model].totalTokens += record.totalTokens;
        modelMap[record.model].totalPromptTokens += record.promptTokens;
        modelMap[record.model].totalCompletionTokens += record.completionTokens;
        modelMap[record.model].totalReasoningTokens += record.reasoningTokens || 0;
        modelMap[record.model].totalOutputTokens += record.outputTokens || record.completionTokens;
        modelMap[record.model].totalDuration += record.duration;
      });
    });

    Object.keys(modelMap).forEach(model => {
      const depthMap: Record<number, DepthPerformanceStats> = {};
      let totalTokens = 0;
      let totalDuration = 0;

      dailyUsages.forEach(day => {
        day.records.forEach(record => {
          if (record.model !== model || !record.duration || record.depth === undefined) return;

          const depth = record.depth;
          if (!depthMap[depth]) {
            depthMap[depth] = {
              depth,
              callCount: 0,
              avgDuration: 0,
              avgPromptTokens: 0,
              avgCompletionTokens: 0,
              avgReasoningTokens: 0,
              avgOutputTokens: 0,
              avgTotalTokens: 0,
              tokensPerSecond: 0,
            };
          }

          depthMap[depth].callCount += 1;
          depthMap[depth].avgDuration += record.duration;
          depthMap[depth].avgPromptTokens += record.promptTokens;
          depthMap[depth].avgCompletionTokens += record.completionTokens;
          depthMap[depth].avgReasoningTokens += record.reasoningTokens || 0;
          depthMap[depth].avgOutputTokens += record.outputTokens || record.completionTokens;
          depthMap[depth].avgTotalTokens += record.totalTokens;

          totalTokens += record.totalTokens;
          totalDuration += record.duration;
        });
      });

      const depthStats = Object.values(depthMap)
        .map(stat => {
          stat.avgDuration = Math.round(stat.avgDuration / stat.callCount);
          stat.avgPromptTokens = Math.round(stat.avgPromptTokens / stat.callCount);
          stat.avgCompletionTokens = Math.round(stat.avgCompletionTokens / stat.callCount);
          stat.avgReasoningTokens = Math.round(stat.avgReasoningTokens / stat.callCount);
          stat.avgOutputTokens = Math.round(stat.avgOutputTokens / stat.callCount);
          stat.avgTotalTokens = Math.round(stat.avgTotalTokens / stat.callCount);
          stat.tokensPerSecond = Math.round(stat.avgTotalTokens / (stat.avgDuration / 1000));
          return stat;
        })
        .sort((a, b) => a.depth - b.depth);

      modelMap[model].depthStats = depthStats;
    });

    const stats = Object.values(modelMap).map(stat => {
      stat.avgDuration = stat.totalCalls > 0 ? Math.round(stat.totalDuration / stat.totalCalls) : 0;
      stat.avgPromptTokens = stat.totalCalls > 0 ? Math.round(stat.totalPromptTokens / stat.totalCalls) : 0;
      stat.avgCompletionTokens = stat.totalCalls > 0 ? Math.round(stat.totalCompletionTokens / stat.totalCalls) : 0;
      stat.avgReasoningTokens = stat.totalCalls > 0 ? Math.round(stat.totalReasoningTokens / stat.totalCalls) : 0;
      stat.avgOutputTokens = stat.totalCalls > 0 ? Math.round(stat.totalOutputTokens / stat.totalCalls) : 0;
      stat.reasoningRatio = stat.totalCompletionTokens > 0 ? Math.round(stat.totalReasoningTokens / stat.totalCompletionTokens * 100) : 0;
      stat.tokensPerSecond = stat.totalDuration > 0 ? Math.round(stat.totalTokens / (stat.totalDuration / 1000)) : 0;
      return stat;
    });

    stats.sort((a, b) => b.totalCalls - a.totalCalls);
    setModelStats(stats);
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };

  const getTotalStats = () => {
    return {
      totalTokens: recentUsage.reduce((sum, d) => sum + d.totalTokens, 0),
      totalDuration: recentUsage.reduce((sum, d) => sum + d.totalDuration, 0),
      totalCalls: recentUsage.reduce((sum, d) => sum + d.callCount, 0),
    };
  };

  const getSelectedModelStats = () => {
    return modelStats.find(s => s.model === selectedModel);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (recentUsage.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8 text-muted-foreground">
          {t('profile.tokenUsage.noRecords')}
        </CardContent>
      </Card>
    );
  }

  const totals = getTotalStats();
  const selectedStats = getSelectedModelStats();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            {t('profile.tokenUsage.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentUsage.map((day) => (
            <div key={day.date} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{day.date}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {t('profile.tokenUsage.calls', { count: day.callCount })}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">
                  {t('profile.tokenUsage.input')}: {day.totalPromptTokens.toLocaleString()}
                </span>
                <span className="text-muted-foreground">
                  {t('profile.tokenUsage.output')}: {day.totalCompletionTokens.toLocaleString()}
                </span>
                <span className="font-medium text-primary">
                  {t('profile.tokenUsage.total')}: {day.totalTokens.toLocaleString()}
                </span>
                {day.totalDuration > 0 && (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(day.totalDuration)}
                  </span>
                )}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between p-2 bg-primary/10 rounded-lg border border-primary/20">
            <span className="text-sm font-medium">{t('profile.tokenUsage.weekTotal')}</span>
            <div className="flex items-center gap-3">
              <span className="font-medium text-primary">
                {totals.totalTokens.toLocaleString()} tokens
              </span>
              {totals.totalDuration > 0 && (
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(totals.totalDuration)}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {modelStats.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {t('profile.tokenUsage.modelPerf')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-7 gap-2 text-xs text-muted-foreground pb-2 border-b">
              <span>{t('profile.tokenUsage.model')}</span>
              <span>{t('profile.tokenUsage.callCount')}</span>
              <span>{t('profile.tokenUsage.avgDuration')}</span>
              <span>{t('profile.tokenUsage.avgInput')}</span>
              <span>{t('profile.tokenUsage.reasoning')}</span>
              <span>{t('profile.tokenUsage.actualOutput')}</span>
              <span>{t('profile.tokenUsage.throughput')}</span>
            </div>
            {modelStats.map((stat) => (
              <div key={stat.model} className="space-y-2">
                <div 
                  className="grid grid-cols-7 gap-2 text-sm items-center cursor-pointer hover:bg-muted/30 p-1 rounded"
                  onClick={() => setSelectedModel(selectedModel === stat.model ? null : stat.model)}
                >
                  <span className="font-medium flex items-center gap-1 min-w-0">
                    {selectedModel === stat.model ? (
                      <ChevronDown className="h-3 w-3 text-primary shrink-0" />
                    ) : (
                      <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate" title={stat.model}>{stat.model}</span>
                  </span>
                  <span className="text-muted-foreground">{t('profile.tokenUsage.timesUnit', { count: stat.totalCalls })}</span>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(stat.avgDuration)}
                  </span>
                  <span className="text-blue-500">{stat.avgPromptTokens}</span>
                  <span className="text-purple-500 flex items-center gap-1">
                    {stat.avgReasoningTokens > 0 && <Brain className="h-3 w-3" />}
                    {stat.avgReasoningTokens}
                    {stat.reasoningRatio > 0 && <span className="text-xs text-muted-foreground">({stat.reasoningRatio}%)</span>}
                  </span>
                  <span className="text-green-500">{stat.avgOutputTokens}</span>
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3 text-yellow-500" />
                    <span className={stat.tokensPerSecond > 100 ? 'text-green-500' : 'text-muted-foreground'}>
                      {stat.tokensPerSecond} t/s
                    </span>
                  </span>
                </div>

                {selectedModel === stat.model && stat.depthStats && stat.depthStats.length > 0 && (
                  <Card className="ml-4 bg-muted/20 border-muted">
                    <CardHeader className="pb-2 pt-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Layers className="h-3 w-3" />
                        {t('profile.tokenUsage.depthTitle', { model: stat.model })}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid grid-cols-7 gap-2 text-xs text-muted-foreground pb-1 border-b">
                        <span>{t('profile.tokenUsage.round')}</span>
                        <span>{t('profile.tokenUsage.arrivals')}</span>
                        <span>{t('profile.tokenUsage.avgDuration')}</span>
                        <span>{t('profile.tokenUsage.avgInput')}</span>
                        <span>{t('profile.tokenUsage.reasoning')}</span>
                        <span>{t('profile.tokenUsage.actualOutput')}</span>
                        <span>{t('profile.tokenUsage.throughput')}</span>
                      </div>
                      {stat.depthStats.map((depthStat) => (
                        <div key={depthStat.depth} className="grid grid-cols-7 gap-2 text-xs items-center">
                          <span className="font-medium">
                            {depthStat.depth === 0 ? t('profile.tokenUsage.initial') : t('profile.tokenUsage.roundN', { n: depthStat.depth })}
                          </span>
                          <span className="text-muted-foreground">{depthStat.callCount}</span>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Clock className="h-2 w-2" />
                            {formatDuration(depthStat.avgDuration)}
                          </span>
                          <span className="text-blue-500">{depthStat.avgPromptTokens}</span>
                          <span className="text-purple-500 flex items-center gap-1">
                            {depthStat.avgReasoningTokens > 0 && <Brain className="h-2 w-2" />}
                            {depthStat.avgReasoningTokens}
                          </span>
                          <span className="text-green-500">{depthStat.avgOutputTokens}</span>
                          <span className="flex items-center gap-1">
                            <Zap className="h-2 w-2 text-yellow-500" />
                            <span className={depthStat.tokensPerSecond > 100 ? 'text-green-500' : 'text-muted-foreground'}>
                              {depthStat.tokensPerSecond} t/s
                            </span>
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            ))}
            <div className="pt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-yellow-500" />
                {t('profile.tokenUsage.throughputHint')}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}