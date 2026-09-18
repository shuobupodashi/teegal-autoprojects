
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';

const LoginForm = () => {
  const { t } = useTranslation();
  const { login, isLoading, setAuthModalView } = useAuth();

  const loginSchema = z.object({
    email: z.string().email(t('auth.login.emailError')),
    password: z.string().min(6, t('auth.login.passwordError')),
  });

  type LoginFormValues = z.infer<typeof loginSchema>;

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // 🔥 从 sessionStorage 恢复输入（用户离开又回来时）
  useEffect(() => {
    const savedEmail = sessionStorage.getItem('teegalLoginEmail');
    if (savedEmail && !form.getValues('email')) {
      form.setValue('email', savedEmail);
    }
  }, [form]);

  // 🔥 保存邮箱到 sessionStorage（用户可能需要复制密码）
  const handleEmailChange = (email: string) => {
    sessionStorage.setItem('teegalLoginEmail', email);
  };

  const onSubmit = async (values: LoginFormValues) => {
    try {
      await login(values.email, values.password);
      sessionStorage.removeItem('teegalLoginEmail');
    } catch (error) {
      // 登录错误由 AuthContext 处理
    }
  };

  const isFormDisabled = isLoading || form.formState.isSubmitting;
  const buttonText = isFormDisabled ? t('auth.login.loginButtonLoading') : t('auth.login.loginButton');

  const handleForgotPassword = () => {
    setAuthModalView('forgot-password');
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.login.email')}</FormLabel>
              <FormControl>
                <Input 
                  placeholder={t('auth.login.emailPlaceholder')} 
                  {...field}
                  onChange={(e) => {
                    field.onChange(e);
                    handleEmailChange(e.target.value);
                  }}
                  disabled={isFormDisabled} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.login.password')}</FormLabel>
              <FormControl>
                <PasswordInput placeholder={t('auth.login.passwordPlaceholder')} {...field} disabled={isFormDisabled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="text-left">
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-xs text-black underline hover:text-gray-700"
          >
            {t('auth.login.forgotPassword')}
          </button>
        </div>
        <Button type="submit" className="w-full bg-black hover:bg-gray-800 text-white" disabled={isFormDisabled}>
          {buttonText}
        </Button>
      </form>
    </Form>
  );
};

export default LoginForm;
