
/**
 * 统一日志管理器 - 减轻前端调试负担
 */

// 日志级别定义
export enum LogLevel {
  DEBUG = 0,
  INFO = 1, 
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

// 环境配置
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// 生产环境默认只显示ERROR级别日志，开发环境显示所有
const DEFAULT_LOG_LEVEL = isProduction ? LogLevel.ERROR : LogLevel.DEBUG;

class Logger {
  private logLevel: LogLevel = DEFAULT_LOG_LEVEL;
  
  setLogLevel(level: LogLevel) {
    this.logLevel = level;
  }
  
  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }
  
  debug(message: string, data?: any) {
    if (this.shouldLog(LogLevel.DEBUG) && isDevelopment) {
      console.log(`🔍 ${message}`, data || '');
    }
  }
  
  info(message: string, data?: any) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(`ℹ️ ${message}`, data || '');
    }
  }
  
  warn(message: string, data?: any) {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(`⚠️ ${message}`, data || '');
    }
  }
  
  error(message: string, data?: any) {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(`❌ ${message}`, data || '');
    }
  }
  
  // 高频调用的性能敏感日志 - 仅在开发环境且明确需要时显示
  performance(category: string, message: string, data?: any) {
    if (isDevelopment && this.logLevel === LogLevel.DEBUG) {
      console.log(`⚡ [${category}] ${message}`, data || '');
    }
  }
  
  // 渲染相关日志 - 可选择性显示
  render(component: string, message: string, data?: any) {
    if (isDevelopment && this.logLevel === LogLevel.DEBUG) {
      console.log(`🔄 [${component}] ${message}`, data || '');
    }
  }
}

// 导出单例实例
export const logger = new Logger();

// 快捷方法导出 - 使用箭头函数保持this绑定
export const debug = (message: string, data?: any) => logger.debug(message, data);
export const info = (message: string, data?: any) => logger.info(message, data);
export const warn = (message: string, data?: any) => logger.warn(message, data);
export const error = (message: string, data?: any) => logger.error(message, data);
export const performance = (category: string, message: string, data?: any) => logger.performance(category, message, data);
export const render = (component: string, message: string, data?: any) => logger.render(component, message, data);
