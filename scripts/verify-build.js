#!/usr/bin/env node
/**
 * 打包验证脚本
 * 在打包后验证关键文件和依赖是否正确
 * 
 * 新的打包结构：
 * - app.asar 包含前端代码（dist、dist-electron）
 * - app.asar.unpacked/local-backend 包含整个 local-backend 目录
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const UNPACKED_DIR = path.join(__dirname, '..', 'release', 'win-unpacked');
const RESOURCES_DIR = path.join(UNPACKED_DIR, 'resources');
const APP_ASAR = path.join(RESOURCES_DIR, 'app.asar');
const APP_ASAR_UNPACKED = path.join(RESOURCES_DIR, 'app.asar.unpacked');
const LOCAL_BACKEND_DIR = path.join(APP_ASAR_UNPACKED, 'local-backend');
const EXTRACTED_DIR = path.join(__dirname, '..', 'release', 'app-extracted');

let hasError = false;

/**
 * 检查文件是否存在
 */
function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`✅ ${description}: ${path.basename(filePath)} (${(stats.size / 1024).toFixed(2)} KB)`);
    return true;
  } else {
    console.error(`❌ ${description} 不存在: ${filePath}`);
    hasError = true;
    return false;
  }
}

/**
 * 检查 better-sqlite3
 */
function checkBetterSqlite3() {
  console.log('\n📦 检查 better-sqlite3...');
  
  const buildPath = path.join(LOCAL_BACKEND_DIR, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
  
  if (!fs.existsSync(buildPath)) {
    console.error('❌ better_sqlite3.node 不存在！');
    hasError = true;
    return;
  }
  
  const stats = fs.statSync(buildPath);
  console.log(`✅ better_sqlite3.node 存在 (${(stats.size / 1024).toFixed(2)} KB)`);
  
  // 检查 lib 目录是否存在
  const libPath = path.join(LOCAL_BACKEND_DIR, 'node_modules', 'better-sqlite3', 'lib', 'database.js');
  if (fs.existsSync(libPath)) {
    console.log('✅ better-sqlite3 lib 目录完整');
  } else {
    console.error('❌ better-sqlite3 lib 目录不完整！');
    hasError = true;
  }
  
  // 检查是否为 Electron 版本（通过文件大小判断，Electron 版本通常更大）
  if (stats.size < 1000000) {
    console.warn('⚠️ 警告：better_sqlite3.node 可能不是 Electron 版本（文件过小）');
    console.warn('   请运行：npm run rebuild:electron');
  } else {
    console.log('✅ better_sqlite3.node 大小正常，应该是 Electron 版本');
  }
}

/**
 * 检查 local-backend 文件（在 app.asar.unpacked 内）
 */
function checkLocalBackendFiles() {
  console.log('\n📦 检查 local-backend 文件（在 app.asar.unpacked 内）...');
  
  checkFile(path.join(LOCAL_BACKEND_DIR, 'dist', 'server.js'), '主入口文件');
  checkFile(path.join(LOCAL_BACKEND_DIR, '.env.encrypted'), '加密环境变量文件');
  checkFile(path.join(LOCAL_BACKEND_DIR, 'package.json'), 'package.json');
}

/**
 * 检查关键依赖
 */
function checkCriticalDependencies() {
  console.log('\n📦 检查关键依赖...');
  
  const criticalDeps = [
    'node_modules/dotenv/lib/main.js',
    'node_modules/express/index.js',
    'node_modules/cors/lib/index.js',
    'node_modules/bindings/bindings.js'
  ];
  
  for (const dep of criticalDeps) {
    checkFile(path.join(LOCAL_BACKEND_DIR, dep), '关键依赖');
  }
}

/**
 * 检查打包结构
 */
function checkPackageStructure() {
  console.log('\n📦 检查打包结构...');
  
  // 检查 app.asar 是否存在
  if (fs.existsSync(APP_ASAR)) {
    const stats = fs.statSync(APP_ASAR);
    console.log(`✅ app.asar 存在 (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  } else {
    console.error('❌ app.asar 不存在！');
    hasError = true;
  }
  
  // 检查 app.asar.unpacked 是否存在
  if (fs.existsSync(APP_ASAR_UNPACKED)) {
    console.log('✅ app.asar.unpacked 目录存在');
  } else {
    console.error('❌ app.asar.unpacked 目录不存在！');
    hasError = true;
  }
  
  // 检查 local-backend 目录是否存在
  if (fs.existsSync(LOCAL_BACKEND_DIR)) {
    console.log('✅ local-backend 目录存在（在 app.asar.unpacked 内）');
  } else {
    console.error('❌ local-backend 目录不存在！');
    hasError = true;
  }
  
  // 检查 app.asar 内是否不包含 local-backend
  if (!fs.existsSync(EXTRACTED_DIR)) {
    console.log('正在提取 app.asar 以验证结构...');
    try {
      execSync(`npx asar extract "${APP_ASAR}" "${EXTRACTED_DIR}"`, { stdio: 'pipe' });
    } catch (error) {
      console.error('❌ 提取 app.asar 失败');
      hasError = true;
      return;
    }
  }
  
  const localBackendInExtracted = fs.existsSync(path.join(EXTRACTED_DIR, 'local-backend'));
  if (localBackendInExtracted) {
    console.warn('⚠️ 警告：app.asar 内包含 local-backend，可能导致重复');
  } else {
    console.log('✅ app.asar 内不包含 local-backend（正确）');
  }
}

/**
 * 清理提取的临时文件
 */
function cleanup() {
  if (fs.existsSync(EXTRACTED_DIR)) {
    console.log('\n🧹 清理临时文件...');
    fs.rmSync(EXTRACTED_DIR, { recursive: true, force: true });
    console.log('✅ 已清理 app-extracted 目录');
  }
}

function main() {
  console.log('🔍 开始验证打包结果...\n');
  
  if (!fs.existsSync(UNPACKED_DIR)) {
    console.error(`❌ 打包目录不存在: ${UNPACKED_DIR}`);
    console.error('请先运行 npm run electron:package:win');
    process.exit(1);
  }
  
  checkPackageStructure();
  checkLocalBackendFiles();
  checkCriticalDependencies();
  checkBetterSqlite3();
  
  console.log('\n' + '='.repeat(50));
  if (hasError) {
    console.error('❌ 验证失败！请检查上述错误。');
    cleanup();
    process.exit(1);
  } else {
    console.log('✅ 验证通过！所有关键文件和依赖都已正确打包。');
    console.log('\n💡 提示：建议在本机测试运行 release/win-unpacked/Teegal.exe 确认功能正常。');
    cleanup();
  }
}

main();