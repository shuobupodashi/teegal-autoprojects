/**
 * 环境构建模块
 *
 * 职责：
 * 1. 根据 Loop 信息（角色、轮次）动态构建环境文本
 * 2. 智能决策注入哪些环境数据
 * 3. 支持多种角色（summarizer、reactor）
 * 4. 支持动态调整策略
 *
 * 使用示例：
 * ```typescript
 * import { EnvironmentBuilder, buildEnvironment } from './environment';
 *
 * // 方式1：使用默认实例
 * const result = await buildEnvironment({
 *   role: 'summarizer',
 *   currentRound: 0,
 *   maxRounds: 6,
 * }, {
 *   userQuery: '帮我搜索新闻',
 * }, {
 *   conversationHistory: chatMessages,
 *   conversationId: 'conv-123',
 * });
 *
 * console.log(result.text);           // 构建好的环境文本
 * console.log(result.injectedFields); // 实际注入的字段
 * console.log(result.strategy);       // 使用的策略名称
 *
 * // 方式2：创建自定义实例
 * const builder = new EnvironmentBuilder({
 *   enableDynamicAdjustment: true,
 * });
 *
 * const result = await builder.build(loopInfo, data, options);
 * ```
 */

// 导出类型
export type {
  EnvironmentRole,
  LoopInfo,
  EnvironmentData,
  ConversationEntry,
  EnvironmentContext,
  InjectionStrategy,
  EnvironmentResult,
  IStrategySelector,
} from './types';

// 导出策略
export {
  DEFAULT_STRATEGY,
  SUMMARY_STRATEGIES,
  ALL_STRATEGIES,
  StrategySelectorClass,
  defaultStrategySelector,
} from './strategies';

// 导出环境构建器
export {
  EnvironmentBuilder,
  defaultEnvironmentBuilder,
  buildEnvironment,
} from './EnvironmentBuilder';
export type { EnvironmentBuilderConfig } from './EnvironmentBuilder';
