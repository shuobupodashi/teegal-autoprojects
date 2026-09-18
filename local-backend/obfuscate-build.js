/**
 * 混淆构建脚本
 * 在 TypeScript 编译后对 JS 文件进行混淆
 */

const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

// 混淆配置
const obfuscatorOptions = {
  compact: true,                    // 压缩代码
  controlFlowFlattening: true,      // 控制流平坦化（增加难度）
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,          // 注入死代码
  deadCodeInjectionThreshold: 0.4,
  debugProtection: false,           // 不禁用调试（开发时可能需要）
  disableConsoleOutput: false,      // 不禁用 console（日志重要）
  identifierNamesGenerator: 'hexadecimal', // 变量名使用十六进制
  log: false,
  numbersToExpressions: true,       // 数字转表达式
  renameGlobals: false,             // 不重命名全局变量（避免破坏 API）
  selfDefending: true,              // 自保护（检测格式化/美化）
  simplify: true,                   // 简化代码
  splitStrings: true,               // 分割字符串
  splitStringsChunkLength: 5,
  stringArray: true,                // 字符串数组
  stringArrayEncoding: ['base64'],  // 字符串编码
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCall: true,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,        // 转换对象键
  unicodeEscapeSequence: false      // 不使用 Unicode 转义（避免中文问题）
};

// 需要混淆的目录
const dirsToObfuscate = [
  'dist/local-storage',
  'dist/routes',
  'dist/code-analyzer',
  'dist/codeedit',
  'dist/codeexecution',
  'dist/container',
  'dist/fileAnalysis',
  'dist/generatevideo',
  'dist/imageedit',
  'dist/planreactionloop',
];

// 主入口文件
const mainFiles = [
  'dist/server.js',
  'dist/database.js',
];

/**
 * 混淆单个文件
 */
function obfuscateFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️ 文件不存在: ${filePath}`);
      return false;
    }

    const code = fs.readFileSync(filePath, 'utf8');
    
    // 检查文件是否已经是混淆过的（避免重复混淆）
    if (code.includes('_0x') || code.length < 100) {
      console.log(`⏭️ 跳过已混淆文件: ${filePath}`);
      return true;
    }

    console.log(`🔒 混淆文件: ${filePath}`);
    
    const obfuscationResult = JavaScriptObfuscator.obfuscate(code, obfuscatorOptions);
    fs.writeFileSync(filePath, obfuscationResult.getObfuscatedCode());
    
    return true;
  } catch (error) {
    console.error(`❌ 混淆失败: ${filePath}`, error.message);
    return false;
  }
}

/**
 * 混淆目录中的所有 JS 文件
 */
function obfuscateDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      console.log(`⚠️ 目录不存在: ${dirPath}`);
      return;
    }

    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        obfuscateDir(fullPath);
      } else if (file.endsWith('.js') && !file.endsWith('.js.map')) {
        obfuscateFile(fullPath);
      }
    }
  } catch (error) {
    console.error(`❌ 处理目录失败: ${dirPath}`, error.message);
  }
}

/**
 * 主函数
 */
function main() {
  // 🔥 --encrypt-only 模式：只重新加密 .env（用于更新镜像 ID 等配置后快速刷新 .env.encrypted，
  //    提交到 git 供 GitHub Actions tag 打包使用），不执行代码混淆
  if (process.argv.includes('--encrypt-only')) {
    encryptEnvFile();
    return;
  }

  console.log('========================================');
  console.log('🔒 开始混淆 local-backend 代码');
  console.log('========================================\n');

  // 🔐 加密 .env 文件
  console.log('\n🔐 加密 .env 文件...');
  encryptEnvFile();

  // 混淆主入口文件
  console.log('\n📦 混淆主入口文件...');
  for (const file of mainFiles) {
    obfuscateFile(file);
  }

  // 混淆各模块目录
  console.log('\n📦 混淆模块目录...');
  for (const dir of dirsToObfuscate) {
    obfuscateDir(dir);
  }

  console.log('\n========================================');
  console.log('✅ 混淆完成!');
  console.log('========================================');
}

/**
 * 加密 .env 文件
 */
function encryptEnvFile() {
  const crypto = require('crypto');
  const envPath = path.join(__dirname, '.env');
  const encryptedPath = path.join(__dirname, '.env.encrypted');

  if (!fs.existsSync(envPath)) {
    console.log('⚠️ .env 文件不存在，跳过加密');
    return;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  // 🔑 AES-256 需要 32 bytes 密钥（正好 32 个字符）
  const ENCRYPTION_KEY = Buffer.from('TeegalSecretKey2026XXXXXXXXXXXXX', 'utf8'); // 32 bytes
  const IV_LENGTH = 16;

  // 生成随机 IV
  const iv = crypto.randomBytes(IV_LENGTH);

  // 创建加密器
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);

  // 加密内容
  let encrypted = cipher.update(envContent, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // 组合 IV + 加密内容
  const combined = iv.toString('hex') + ':' + encrypted;

  // 写入加密文件
  fs.writeFileSync(encryptedPath, combined, 'utf8');

  console.log('✅ .env 已加密为 .env.encrypted');
}

main();