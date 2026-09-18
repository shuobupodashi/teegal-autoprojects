/**
 * 🔥 动态知识库 - 自动学习的知识点
 * 由 ReActExecutor 在运行过程中自动记录 LLM 的经验总结
 */

export interface DynamicKnowledgeItem {
  /** 知识点内容（经验总结） */
  content: string;
  /** 分类 */
  category: 'training' | 'data' | 'model' | 'platform' | 'tool' | 'lesson';
  /** 来源：固定为 auto */
  source: 'auto';
  /** 创建时间 */
  createdAt: string;
}

/**
 * 动态知识库数组
 */
export const dynamicKnowledgeBase: DynamicKnowledgeItem[] = [];
