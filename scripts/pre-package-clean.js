/**
 * 打包前清理脚本
 * 注意：只清理 dist 目录中的 .map 和 .d.ts 文件
 * 不删除 src、tmp、data 等目录，因为开发环境需要
 */

const fs = require('fs');
const path = require('path');

const LOCAL_BACKEND_DIR = path.join(__dirname, '..', 'local-backend');

function main() {
  console.log('========================================');
  console.log('🧹 打包前清理 local-backend');
  console.log('========================================\n');

  // 清理 dist 中的 .map 和 .d.ts 文件
  const distDir = path.join(LOCAL_BACKEND_DIR, 'dist');
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
	      if (fs.existsSync(fullPath)) {
	        console.log(`🗑️ 删除文件: ${fullPath}`);
	        fs.unlinkSync(fullPath);
	      }
    }
  }
}

main();