/**
 * Plan-Reaction-Loop 协议模块
 * 集中管理所有 LLM 系统提示词和工具选择协议
 * 
 * 优势：
 * 1. 便于调整和优化提示词效果
 * 2. 支持多套协议切换，增强结果鲁棒性
 * 3. 便于版本管理和 A/B 测试
 * 4. 降低 Service 类的复杂度
 */

export { SummaryProtocols } from './SummaryProtocols';
export { ReActProtocols } from './ReActProtocols';
