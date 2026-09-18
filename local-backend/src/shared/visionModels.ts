/**
 * 🔥 视觉（多模态）模型注册表 —— 前后端唯一维护点
 *
 * 被两端共同 import：
 * - 后端：SummaryModule（summary 多模态消息）、UrlReaderService（图片/视频理解选模型）
 * - 前端：CustomModelDialog（视觉角标）、ModelSettings、OptimizedChatInput
 *
 * 约束：本文件必须是纯常量 + 纯函数，禁止 import 任何 Node/浏览器特有模块
 */

/** 已知支持图片理解（多模态输入）的模型 ID 前缀 */
export const VISION_MODEL_PREFIXES = [
  // OpenAI（精确到子版本，避免 gpt-5 宽泛前缀误判 gpt-5-mini）
  'gpt-4o', 'gpt-4.1', 'gpt-5.4', 'gpt-5.5', 'gpt-5.6',
  // Google（Gemini 全系列支持多模态，含 flash 变体）
  'gemini',
  // Anthropic（Claude 3+ 全系列支持多模态）
  'claude-3', 'claude-4', 'claude-5',
  // Moonshot
  'kimi-k2.5', 'kimi-k2.6', 'kimi-k2.7', 'kimi-k3', 'kimi-k4',
  // 智谱（GLM-4V 视觉版）
  'glm-4v', 'glm-4.1v',
  // Qwen（VL 通用前缀 + 特定版本）
  'qwen-vl', 'qwen3.7-plus', 'qwen3.8-max', 'qwen3.8-plus',
  // DeepSeek（Flash Vision 实验版）
  'deepseek-v4-flash-vision-exp',
  // 火山方舟（豆包 Vision 系列 + Seed 2.x 全模态版：官方模型页输入类型为文本/图片/视频）
  'doubao-seed-1.6-vision', 'doubao-1.5-vision', 'doubao-1.6-vision', 'doubao-seed-2',
  // MiniMax
  'minimax-m3', 'minimax-m4',
];

/** 需要精确匹配的视觉模型（前缀匹配会误伤同类非视觉版本） */
export const VISION_MODEL_EXACT = [
  // 小米 MiMo（仅 v2.5 基础版支持多模态，v2.5-pro 不支持）
  'mimo-v2.5',
];

/** 支持视频理解的模型前缀（OpenAI 兼容 API 的 video_url content part），其余视觉模型仅支持图片 */
export const VIDEO_CAPABLE_PREFIXES = [
  // Qwen-VL 全系（DashScope compatible-mode 支持 video_url）
  'qwen-vl',
  // Gemini 全系
  'gemini',
  // 豆包 Seed 2.x：视频理解只能走方舟 Responses API（Chat API 静默忽略 video_url，实测 2026-08），
  // 因此仅当模型 url 指向 /responses 端点时才算视频可用（见 isVideoCapableModel 的 url 参数）
  'doubao-seed-2',
];

/** 剥掉厂商前缀（OpenRouter 格式：anthropic/claude-5.6-sonnet → claude-5.6-sonnet） */
function bareModelId(modelId: string): string {
  const lower = modelId.toLowerCase().trim();
  return lower.includes('/') ? (lower.split('/').pop() || lower) : lower;
}

/**
 * 🔥 判断模型是否支持图片理解（多模态输入）
 *
 * 判断顺序（正向往前，排除垫后——保证 gemini-flash 这类正表中含 flash 的模型不被误杀）：
 * 1. vision/vl 关键词 → 一定是视觉模型（新模型零维护成本）
 * 2. 精确匹配 → true
 * 3. 前缀匹配 → true
 * 4. 轻量版关键词（mini/nano/flash/lite/air）→ false（只拦不在正表里的）
 *
 * 注意：这是自动检测的默认值，用户在模型设置中手动声明的 supportsVision 优先于此判断
 */
export function detectVisionByModelId(modelId: string): boolean {
  if (!modelId) return false;
  const id = modelId.toLowerCase().trim();
  const bare = bareModelId(modelId);
  // 1. 显式带 vision/vl 的模型一定是视觉模型，如 deepseek-v4-flash-vision-exp
  if (/\bvl\b|vision|visual|multimodal/.test(id)) return true;
  // 2. 精确匹配（不走前缀，避免 mimo-v2.5 误匹配 mimo-v2.5-pro）
  if (VISION_MODEL_EXACT.some(p => bare === p)) return true;
  // 3. 前缀匹配（gpt-5.6 → gpt-5.6-sol；gemini → gemini-2.5-flash）
  if (VISION_MODEL_PREFIXES.some(p => bare.startsWith(p))) return true;
  // 4. 排除轻量版本（\b 避免 minimax 被误匹配为 mini）
  if (/\b(mini|nano|flash|lite|air)\b/.test(bare)) return false;
  return false;
}

/** 后端语义化别名（SummaryModule/UrlReaderService 的多模态判断入口） */
export { detectVisionByModelId as isMultimodalModel };

/**
 * 🔥 判断模型是否支持视频理解（视频场景只认这些，图片级视觉模型会被排除）
 * @param url 可选：模型请求端点。doubao-seed-2 只有走 /responses 端点（LLMService 的
 *            Responses 双向转换）才能真正读到视频，Chat 端点会被上游静默忽略 → 返回 false
 */
export function isVideoCapableModel(modelId: string, url?: string): boolean {
  if (!modelId) return false;
  const bare = bareModelId(modelId);
  const hit = VIDEO_CAPABLE_PREFIXES.find(p => bare.startsWith(p));
  if (!hit) return false;
  // doubao-seed-2 的视频能力依赖请求最终以 Responses 格式到达方舟，两条通路都算可用：
  // ① 自配模型 url 直指 /responses 端点（LLMService 的 Responses 双向转换）
  // ② 套餐模型走 llm-proxy（服务端已对 ark 渠道做双向转换）
  if (bare.startsWith('doubao-seed-2')) {
    const u = (url || '').toLowerCase();
    return u.includes('/responses') || u.includes('/llm-proxy');
  }
  return true;
}

/**
 * 🔥 媒体生成模型细分类型（UI 图标与工具路由共用）
 * - 'video'      视频生成（seedance / veo / wan-t2v/i2v 等）
 * - 'image'      图片生成（seedream / gpt-image 等）
 * - 'image-edit' 图片编辑（seededit / qwen-image-edit / wanx 等）
 * - null         非媒体生成模型（可当对话模型用）
 */
export type MediaGenerationKind = 'video' | 'image' | 'image-edit' | null;

/** 🔥 判断媒体生成模型的具体类型（判断顺序：视频 → 图片编辑 → 图片生成） */
export function getMediaGenerationKind(modelId: string): MediaGenerationKind {
  if (!modelId) return null;
  const bare = bareModelId(modelId);
  // 视频生成：t2v/i2v 独立词段（万相）或视频模型前缀
  if (/(^|[-_.])(t2v|i2v)([-_.]|$)/.test(bare)) return 'video';
  // MiniMax 海螺系列：minimax-h3 简写 / minimax-hailuo-3 全称（直连 API 无斜杠格式；区别于 M 系列对话模型）
  if (/^minimax-h\d/.test(bare) || bare.startsWith('minimax-hailuo')) return 'video';
  if (['seedance', 'veo', 'sora', 'kling', 'hailuo'].some(p => bare.startsWith(p))) return 'video';
  // 图片编辑（须在图片生成之前判断：qwen-image-edit 同时匹配 qwen-image 前缀）
  if (/seededit|image[-_.]?edit/.test(bare) || bare.startsWith('wanx')) return 'image-edit';
  // 图片生成
  if (['seedream', 'gpt-image', 'dall-e', 'flux', 'imagen', 'qwen-image', 'stable-diffusion', 'sd3'].some(p => bare.startsWith(p))) return 'image';
  return null;
}

/**
 * 🔥 判断是否为媒体生成模型（视频/图片生成、图片编辑）
 *
 * 识别规则：
 * 1. t2v / i2v 关键词（万相 wan2.5-t2v-preview / wan2.5-i2v-preview 等）
 * 2. 前缀匹配（seedance-2.5、seedream-5.0、veo-3.1、gpt-image-2 等）
 */
export function isMediaGenerationModel(modelId: string): boolean {
  return getMediaGenerationKind(modelId) !== null;
}
