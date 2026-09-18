/**
 * 🔐 .env 文件解密工具
 * 在运行时解密 .env.encrypted 文件并加载到 process.env
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// 🔑 内置密钥（与 obfuscate-build.js 中的密钥一致）
// AES-256 需要 32 bytes 密钥（正好 32 个字符）
const ENCRYPTION_KEY = Buffer.from('TeegalSecretKey2026XXXXXXXXXXXXX', 'utf8'); // 32 bytes

/**
 * 解密 .env.encrypted 文件并加载到 process.env
 */
export function loadEncryptedEnv(): void {
  // 尝试多个可能的路径
  const possiblePaths = [
    // 🔥 打包后：app.asar.unpacked/local-backend/.env.encrypted
    // @ts-ignore - Electron 特有属性
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', 'local-backend', '.env.encrypted') : null,
    // 开发环境：local-backend/.env.encrypted
    path.join(__dirname, '../../.env.encrypted'),
    // 当前工作目录
    path.join(process.cwd(), '.env.encrypted'),
    // Electron 资源目录
    process.env.USER_DATA_DIR ? path.join(process.env.USER_DATA_DIR, '../local-backend/.env.encrypted') : null,
  ].filter(Boolean) as string[];

  const plainEnvPaths = [
    path.join(__dirname, '../../.env'),
    path.join(__dirname, '../.env'),
    path.join(process.cwd(), '.env'),
  ];

  // 查找加密文件
  for (const encryptedPath of possiblePaths) {
    if (fs.existsSync(encryptedPath)) {
      try {
        console.log('🔐 [EnvDecryptor] 正在解密:', encryptedPath);
        
        const encryptedContent = fs.readFileSync(encryptedPath, 'utf8');
        
        // 解析 IV 和加密内容
        const parts = encryptedContent.split(':');
        if (parts.length !== 2) {
          throw new Error('加密文件格式错误');
        }
        
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        
        // 创建解密器
        const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        
        // 解密内容
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        // 解析环境变量
        const lines = decrypted.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          // 跳过注释和空行
          if (!trimmed || trimmed.startsWith('#')) continue;
          
          const match = trimmed.match(/^([^=]+)=(.*)$/);
          if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            // 只设置未定义的环境变量
            if (process.env[key] === undefined) {
              process.env[key] = value;
            }
          }
        }
        
        console.log('✅ [EnvDecryptor] 已成功解密并加载环境变量');
        return;
      } catch (error) {
        console.error('❌ [EnvDecryptor] 解密失败:', error);
        // 继续尝试下一个路径
      }
    }
  }

  // 未找到加密文件，尝试普通 .env
  for (const plainEnvPath of plainEnvPaths) {
    if (fs.existsSync(plainEnvPath)) {
      console.log('📝 [EnvDecryptor] 使用普通 .env 文件（开发模式）:', plainEnvPath);
      require('dotenv').config({ path: plainEnvPath });
      return;
    }
  }

  console.log('⚠️ [EnvDecryptor] 未找到 .env 或 .env.encrypted 文件');
}