
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

interface OtpVerificationProps {
  email: string;
  onBack: () => void;
  type?: 'register' | 'reset';
}

const OtpVerification = ({ email, onBack, type = 'register' }: OtpVerificationProps) => {
  const { t } = useTranslation();
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { 
    verifyOtp, 
    resendOtp, 
    verifyResetCode,
    pendingPassword, 
    setAuthModalView,
    setPendingResetCode 
  } = useAuth();

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error(t('auth.otp.otpError'));
      return;
    }

    setIsVerifying(true);
    try {
      if (type === 'register') {
        await verifyOtp(email, otp);
        toast.success(t('auth.otp.verifySuccess'));
      } else {
        // 🔥 使用 AuthContext 的 verifyResetCode 方法
        await verifyResetCode(email, otp);
        
        setPendingResetCode(otp);
        setAuthModalView('reset-password');
        toast.success(t('auth.otp.resetVerifySuccess'));
      }
    } catch (error) {
      console.error('OTP验证失败:', error);
      toast.error(t('auth.otp.verifyError'));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    
    try {
      await resendOtp(email);
      setCountdown(60);
      toast.success(t('auth.otp.resendSuccess'));
    } catch (error) {
      console.error('重新发送验证码失败:', error);
      toast.error(t('auth.otp.resendError'));
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold">
          {type === 'register' ? t('auth.otp.registerTitle') : t('auth.otp.resetTitle')}
        </h3>
        <p className="text-sm text-gray-600 mt-2">
          {t('auth.otp.subtitle', { email })}
        </p>

      </div>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="otp" className="block text-sm font-medium mb-2">
            {t('auth.otp.verificationCode')}
          </label>
          <Input
            id="otp"
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            className="text-center text-lg tracking-wider"
          />
        </div>

        <Button 
          onClick={handleVerifyOtp} 
          disabled={isVerifying || otp.length !== 6}
          className="w-full bg-black hover:bg-gray-800 text-white"
        >
          {isVerifying ? t('auth.otp.verifyButtonLoading') : t('auth.otp.verifyButton')}
        </Button>

        <div className="text-center space-y-2">
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={countdown > 0}
            className="text-sm text-black underline hover:text-gray-700 disabled:text-gray-400 disabled:no-underline"
          >
            {countdown > 0 ? t('auth.otp.resendCountdown', { seconds: countdown }) : t('auth.otp.resendCode')}
          </button>
          
          <div>
            <button
              type="button"
              onClick={onBack}
              className="text-sm text-gray-600 hover:underline"
            >
              {type === 'register' ? t('auth.otp.backToRegister') : t('auth.otp.backToForgotPassword')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OtpVerification;
