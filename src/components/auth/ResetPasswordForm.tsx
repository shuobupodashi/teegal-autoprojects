
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

interface ResetPasswordFormProps {
  onBack: () => void;
}

const ResetPasswordForm = ({ onBack }: ResetPasswordFormProps) => {
  const { t } = useTranslation();
  const { isLoading, pendingResetEmail, pendingResetCode, resetPassword, setShowAuthModal, setAuthModalView } = useAuth();

  const resetPasswordSchema = z.object({
    newPassword: z.string()
      .min(8, t('auth.resetPassword.passwordError'))
      .max(100, t('auth.resetPassword.passwordMaxError'))
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, t('auth.resetPassword.passwordFormatError')),
    confirmPassword: z.string()
      .min(8, t('auth.resetPassword.confirmPasswordError')),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: t('auth.resetPassword.passwordMismatchError'),
    path: ["confirmPassword"]
  });

  type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: ResetPasswordFormValues) => {
    if (!pendingResetEmail) {
      console.error('Missing reset email');
      toast.error('缺少重置邮箱信息');
      return;
    }

    if (!pendingResetCode) {
      console.error('Missing reset code');
      toast.error('缺少验证码信息，请重新验证');
      onBack();
      return;
    }

    try {
      await resetPassword(pendingResetEmail, pendingResetCode, values.newPassword);
      toast.success(t('auth.resetPassword.resetSuccess'));
      setShowAuthModal(false);
      setAuthModalView('login');
    } catch (error: any) {
      console.error('密码重置失败:', error);
      const reason = error?.message || t('auth.resetPassword.resetError');
      toast.error(`${t('auth.resetPassword.resetError')}：${reason}`);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold">{t('auth.resetPassword.title')}</h3>
        <p className="text-sm text-gray-600 mt-2">
          {t('auth.resetPassword.subtitle')}
        </p>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.resetPassword.newPassword')}</FormLabel>
                <FormControl>
                  <PasswordInput
                    placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
                    maxLength={100}
                    {...field}
                    disabled={isLoading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.resetPassword.confirmPassword')}</FormLabel>
                <FormControl>
                  <PasswordInput
                    placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
                    maxLength={100}
                    {...field}
                    disabled={isLoading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <Button type="submit" className="w-full bg-black hover:bg-gray-800 text-white" disabled={isLoading}>
            {isLoading ? t('auth.resetPassword.resetButtonLoading') : t('auth.resetPassword.resetButton')}
          </Button>
          
          <div className="text-center">
            <button
              type="button"
              onClick={onBack}
              className="text-sm text-gray-600 hover:underline"
            >
              {t('auth.resetPassword.backToVerification')}
            </button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default ResetPasswordForm;
