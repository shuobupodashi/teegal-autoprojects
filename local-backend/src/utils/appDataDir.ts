/**
 * 应用数据根目录
 * 默认 <local-backend>/.teegal，可用 USER_DATA_DIR 环境变量覆盖
 * 首次访问时自动把旧命名目录 .bbone-tagalong 迁移为 .teegal
 */
import * as fs from 'fs';
import * as path from 'path';

export function resolveAppDataDir(): string {
  if (process.env.USER_DATA_DIR) {
    return process.env.USER_DATA_DIR;
  }
  const dir = path.resolve(__dirname, '../.teegal');
  const legacyDir = path.resolve(__dirname, '../.bbone-tagalong');
  try {
    if (fs.existsSync(legacyDir) && !fs.existsSync(dir)) {
      fs.renameSync(legacyDir, dir);
      console.log('📁 [APP-DATA] 已迁移旧数据目录: .bbone-tagalong -> .teegal');
    }
  } catch (error) {
    console.warn('⚠️ [APP-DATA] 旧数据目录迁移失败，忽略:', error);
  }
  return dir;
}
