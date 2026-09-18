/**
 * ErrorBoundary - 全局错误边界组件
 * 
 * 🔥 防止 React 组件渲染错误导致整个应用白屏
 * 捕获子组件树中的 JavaScript 错误，记录错误并显示备用 UI
 */

import React, { Component, ErrorInfo } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // 更新 state 使下一次渲染能够显示备用 UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 记录错误信息
    console.error('❌ [ErrorBoundary] 捕获到渲染错误:', error);
    console.error('❌ [ErrorBoundary] 错误堆栈:', errorInfo.componentStack);
    
    this.setState({
      errorInfo,
    });

    // 🔥 可以在这里上报错误到监控系统
    // reportErrorToService(error, errorInfo);
  }

  handleReset = (): void => {
    // 重置错误状态
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = (): void => {
    // 刷新页面
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      // 如果提供了自定义备用 UI，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认备用 UI
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-8">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <h1 className="text-xl font-semibold text-gray-900">应用出现错误</h1>
            </div>
            
            <p className="text-gray-600 mb-4">
              应用遇到了一个意外错误。您可以尝试重置组件或刷新页面。
            </p>

            {this.state.error && (
              <div className="mb-4 p-3 bg-gray-100 rounded-md overflow-auto">
                <p className="text-sm font-medium text-gray-700 mb-1">错误信息：</p>
                <p className="text-sm text-red-600">{this.state.error.message}</p>
              </div>
            )}

            {this.state.errorInfo && (
              <details className="mb-4">
                <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                  查看详细堆栈信息
                </summary>
                <pre className="mt-2 p-3 bg-gray-100 rounded-md text-xs text-gray-600 overflow-auto max-h-200">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-3">
              <Button
                onClick={this.handleReset}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                重置组件
              </Button>
              <Button
                onClick={this.handleReload}
                variant="default"
                className="flex items-center gap-2"
              >
                刷新页面
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;