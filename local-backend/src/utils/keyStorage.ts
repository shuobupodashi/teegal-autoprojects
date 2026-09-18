/**
 * 🔐 密钥对持久化存储
 * 用于在本地安全存储 RSA 密钥对
 *
 * 🔥 重要：使用 USER_DATA_DIR 环境变量，而不是 process.cwd()
 * 因为在生产环境中，程序安装在 C:\Program Files，普通用户无写入权限
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * 获取密钥存储目录
 * 🔥 优先使用 USER_DATA_DIR 环境变量（Electron 传递的用户数据目录）
 */
function getKeysDir(): string {
  const userDataDir = process.env.USER_DATA_DIR;
  if (userDataDir) {
    return path.join(userDataDir, 'data', '.keys');
  }
  // 回退到当前工作目录（开发环境）
  return path.join(process.cwd(), 'data', '.keys');
}

/**
 * 获取私钥文件路径
 */
function getPrivateKeyFile(): string {
  return path.join(getKeysDir(), 'gpu_private.pem');
}

/**
 * 获取公钥文件路径
 */
function getPublicKeyFile(): string {
  return path.join(getKeysDir(), 'gpu_public.pem');
}

/**
 * 确保密钥目录存在
 */
function ensureKeysDir(): void {
  const keysDir = getKeysDir();
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true, mode: 0o700 }); // 仅所有者可读写
    console.log('📁 [KeyStorage] 创建密钥目录:', keysDir);
  }
}

/**
 * 🔑 保存密钥对到本地文件
 */
export function saveKeyPair(privateKey: string, publicKey: string): void {
  ensureKeysDir();

  const privateKeyFile = getPrivateKeyFile();
  const publicKeyFile = getPublicKeyFile();

  // 保存私钥（设置严格权限）
  fs.writeFileSync(privateKeyFile, privateKey, { mode: 0o600 });

  // 保存公钥
  fs.writeFileSync(publicKeyFile, publicKey, { mode: 0o644 });

  console.log('🔐 [KeyStorage] 密钥对已保存到:', getKeysDir());
}

/**
 * 🔑 从本地文件加载密钥对
 */
export function loadKeyPair(): { privateKey: string | null; publicKey: string | null } {
  try {
    const privateKeyFile = getPrivateKeyFile();
    const publicKeyFile = getPublicKeyFile();

    if (!fs.existsSync(privateKeyFile) || !fs.existsSync(publicKeyFile)) {
      return { privateKey: null, publicKey: null };
    }

    const privateKey = fs.readFileSync(privateKeyFile, 'utf-8');
    const publicKey = fs.readFileSync(publicKeyFile, 'utf-8');

    console.log('🔐 [KeyStorage] 已从本地加载密钥对');

    return { privateKey, publicKey };
  } catch (error) {
    console.error('❌ [KeyStorage] 加载密钥对失败:', error);
    return { privateKey: null, publicKey: null };
  }
}

/**
 * 🧹 清除本地存储的密钥对
 */
export function clearKeyPair(): void {
  try {
    const privateKeyFile = getPrivateKeyFile();
    const publicKeyFile = getPublicKeyFile();

    if (fs.existsSync(privateKeyFile)) {
      fs.unlinkSync(privateKeyFile);
    }
    if (fs.existsSync(publicKeyFile)) {
      fs.unlinkSync(publicKeyFile);
    }
    console.log('🧹 [KeyStorage] 已清除本地密钥对');
  } catch (error) {
    console.error('❌ [KeyStorage] 清除密钥对失败:', error);
  }
}

/**
 * 🔍 检查是否已有存储的密钥对
 */
export function hasKeyPair(): boolean {
  return fs.existsSync(getPrivateKeyFile()) && fs.existsSync(getPublicKeyFile());
}
