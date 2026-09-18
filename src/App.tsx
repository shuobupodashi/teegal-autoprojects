import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { Suspense, lazy, useEffect } from "react";
// 导入 i18n 配置
import "./i18n/index";
// 新增：全局认证弹窗组件导入
import AuthModal from "@/components/auth/AuthModal";
import WaveformLoader from "@/components/ui/waveform-loader";
// 🔥 初始化存储模式
import { storageMode } from "@/services/storage";
import { UpdateNotification } from "@/components/updater/UpdateNotification";
// 🔥 全局链接拦截
import { useLinkInterceptor } from "@/hooks/useLinkInterceptor";
// 🔥 全局错误边界
import ErrorBoundary from "@/components/common/ErrorBoundary";

// 🔥 性能优化：关键页面组件预加载（使用正确参数格式）
const Workspace = lazy(() => import(/* webpackChunkName: "workspace" */ "./pages/Workspace"));
const Terms = lazy(() => import(/* webpackChunkName: "terms" */ "./pages/Terms"));
const Privacy = lazy(() => import(/* webpackChunkName: "privacy" */ "./pages/Privacy"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const NotFound = lazy(() => import("./pages/NotFound"));
// 🔥 项目查看器独立窗口页面（Electron 独立 BrowserWindow 加载）
const AppViewerPage = lazy(() => import("./pages/AppViewerPage"));

// 预加载高频组件函数
const preloadHighFrequencyComponents = async () => {
  await Promise.all([
    import("./pages/Workspace")
  ]);
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5分钟缓存
    },
  },
});

const App = () => {
  // 🔥 启用全局链接拦截
  useLinkInterceptor();

  useEffect(() => {
    // 🔥 初始化存储模式（从 localStorage 读取已保存的模式）
    storageMode.init();

    // 🔥 基础项目工具加载已移至 ToolHandler 构造时（需要 userId）
    // 由 loadBaseProjectTools 在首次对话时触发，确保基础项目存在并加载工具

    // 在应用启动后预加载高频组件
    preloadHighFrequencyComponents().then(() => {
      console.log("高频组件预加载完成");
    });
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <Sonner />
            <HashRouter>
              {/* 🔥 AuthModal 移到 HashRouter 内部，可以使用 Link */}
              <AuthModal />
              <UpdateNotification />
              <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><WaveformLoader size={48} color="#10B981" /></div>}>
                <Routes>
                  {/* Home 页面 */}
                  <Route path="/" element={<Workspace />} />
                  <Route path="/workspace" element={<Workspace />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/payment-success" element={<PaymentSuccess />} />
                  {/* 🔥 项目查看器独立窗口（Electron 下由独立 BrowserWindow 加载） */}
                  <Route path="/app-viewer" element={<AppViewerPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </HashRouter>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
