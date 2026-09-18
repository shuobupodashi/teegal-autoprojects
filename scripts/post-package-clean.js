/**
 * 打包后清理脚本
 * 清理 app.asar.unpacked/local-backend 中不需要的目录和文件
 */

const fs = require('fs');
const path = require('path');

const RELEASE_DIR = path.join(__dirname, '..', 'release', 'win-unpacked', 'resources', 'app.asar.unpacked', 'local-backend');

// 需要删除的目录（相对于 local-backend）
const DIRS_TO_REMOVE = [
  'src',
  'tmp',
  'data',
  '.teegal'
];

// 需要删除的文件（相对于 local-backend）
const FILES_TO_REMOVE = [
  '.env.example',
  '.dockerignore',
  'tsconfig.json',
  'encrypt-env.js',
  'obfuscate-build.js',
  'README.md',
  '.gitignore'
];

function removeDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    console.log(`🗑️ 删除目录: ${dirPath}`);
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

function removeFile(filePath) {
  if (fs.existsSync(filePath)) {
    console.log(`🗑️ 删除文件: ${filePath}`);
    fs.unlinkSync(filePath);
  }
}

function main() {
  console.log('========================================');
  console.log('🧹 打包后清理 app.asar.unpacked/local-backend');
  console.log('========================================\n');

  if (!fs.existsSync(RELEASE_DIR)) {
    console.log('⚠️ 目录不存在: ' + RELEASE_DIR);
    return;
  }

  // 删除目录
  for (const dir of DIRS_TO_REMOVE) {
    const fullPath = path.join(RELEASE_DIR, dir);
    removeDir(fullPath);
  }

  // 删除文件
  for (const file of FILES_TO_REMOVE) {
    const fullPath = path.join(RELEASE_DIR, file);
    removeFile(fullPath);
  }

  // 清理 dist 中的 .map 和 .d.ts 文件
  const distDir = path.join(RELEASE_DIR, 'dist');
  if (fs.existsSync(distDir)) {
    console.log('\n🧹 清理 dist 目录中的 .map 和 .d.ts 文件...');
    cleanDistDir(distDir);
  }

  console.log('\n========================================');
  console.log('✅ 清理完成!');
  console.log('========================================');
}

function cleanDistDir(dirPath) {
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      cleanDistDir(fullPath);
    } else if (file.endsWith('.map') || file.endsWith('.d.ts') || file.endsWith('.d.ts.map')) {
      removeFile(fullPath);
    }
  }
}

main();