
/**
 * UUID 验证工具函数
 */
export const isValidUUID = (value: any): value is string => {
  if (typeof value !== 'string') return false;
  if (value === 'null' || value === 'undefined' || value === '') return false;
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

/**
 * 安全获取UUID，确保返回有效UUID或null
 */
export const safeGetUUID = (value: any): string | null => {
  return isValidUUID(value) ? value : null;
};

/**
 * 生成基于时间戳的UUID v4格式 jobId
 * 格式: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * 其中时间戳编码在前8位，确保时间有序性
 */
export const generateJobId = (): string => {
  const timestamp = Date.now();
  const hex = timestamp.toString(16).padStart(12, '0');
  
  // 使用时间戳的后12位
  const timePart = hex.slice(-12);
  
  // 生成随机部分
  const random = () => Math.floor(Math.random() * 16).toString(16);
  const randomBlock = () => Array.from({ length: 4 }, random).join('');
  
  // UUID v4 格式: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // 第一部分使用时间戳 (8位)
  const part1 = timePart.slice(0, 8);
  // 第二部分使用时间戳 (4位)
  const part2 = timePart.slice(8, 12);
  // 第三部分：4开头表示版本4 (4位)
  const part3 = '4' + randomBlock().slice(1);
  // 第四部分：8/9/a/b开头表示变体 (4位)
  const variant = ['8', '9', 'a', 'b'][Math.floor(Math.random() * 4)];
  const part4 = variant + randomBlock().slice(1);
  // 第五部分：纯随机 (12位)
  const part5 = randomBlock() + randomBlock() + randomBlock();
  
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
};
