import React, { lazy, Suspense } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';

// 🔥 懒加载表单组件，减少初始渲染负担
const LoginForm = lazy(() => import('./LoginForm'));
const RegisterForm = lazy(() => import('./RegisterForm'));
const OtpVerification = lazy(() => import('./OtpVerification'));
const ForgotPasswordForm = lazy(() => import('./ForgotPasswordForm'));
const ResetPasswordForm = lazy(() => import('./ResetPasswordForm'));

// 🔥 加载占位组件
const FormLoading = () => (
  <div className="flex items-center justify-center py-8">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
  </div>
);

const AuthModal = () => {
  const { t } = useTranslation();
  const { 
    showAuthModal, 
    setShowAuthModal, 
    authModalView, 
    setAuthModalView, 
    pendingEmail,
    pendingResetEmail
  } = useAuth();

  const handleTabChange = (value: string) => {
    if (value !== 'otp' && value !== 'forgot-password' && value !== 'reset-password') {
      setAuthModalView(value as 'login' | 'register');
    }
  };

  const handleBackToRegister = () => {
    setAuthModalView('register');
  };

  const handleBackToLogin = () => {
    setAuthModalView('login');
  };

  const handleBackToForgotPassword = () => {
    setAuthModalView('forgot-password');
  };

  const getOtpType = () => {
    if (pendingResetEmail) return 'reset';
    return 'register';
  };

  return (
    <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
      <DialogContent className="sm:max-w-[425px]" overlayClassName="bg-black/40 backdrop-blur-sm">
        {/* 🔥 添加 DialogTitle 和 DialogDescription 以满足可访问性要求 */}
        <DialogTitle className="sr-only">
          {authModalView === 'login' ? t('auth.login.title') :
           authModalView === 'register' ? t('auth.register.title') :
           authModalView === 'otp' ? t('auth.otp.title') :
           authModalView === 'forgot-password' ? t('auth.forgotPassword.title') :
           authModalView === 'reset-password' ? t('auth.resetPassword.title') :
           'Authentication'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {t('auth.modal.description', 'Please sign in to your account or create a new one')}
        </DialogDescription>
        {/* 🔥 简化logo结构，移除冗余嵌套 */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <h1 className="text-lg font-semibold">Teegal</h1>
        </div>
        {authModalView === 'otp' ? (
          <Suspense fallback={<FormLoading />}>
            <OtpVerification 
              email={pendingEmail || pendingResetEmail || ''} 
              onBack={pendingResetEmail ? handleBackToForgotPassword : handleBackToRegister}
              type={getOtpType()}
            />
          </Suspense>
        ) : authModalView === 'forgot-password' ? (
          <Suspense fallback={<FormLoading />}>
            <ForgotPasswordForm onBack={handleBackToLogin} />
          </Suspense>
        ) : authModalView === 'reset-password' ? (
          <Suspense fallback={<FormLoading />}>
            <ResetPasswordForm onBack={handleBackToForgotPassword} />
          </Suspense>
        ) : (
          <Tabs value={authModalView} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-2" style={{ backgroundColor: '#F7F4ED' }}>
              <TabsTrigger value="login" className="text-gray-800 data-[state=active]:font-bold data-[state=active]:text-black">{t('auth.login.title')}</TabsTrigger>
              <TabsTrigger value="register" className="text-gray-800 data-[state=active]:font-bold data-[state=active]:text-black">{t('auth.register.title')}</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <Suspense fallback={<FormLoading />}>
                <LoginForm />
              </Suspense>
            </TabsContent>
            <TabsContent value="register">
              <Suspense fallback={<FormLoading />}>
                <RegisterForm />
              </Suspense>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;