
import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';

// 🔥 创建 schema 的工厂函数，避免每次渲染都重新创建
const createRegisterSchema = (t: any) => z.object({
  name: z.string()
    .min(2, t('auth.register.nameError'))
    .max(50, t('auth.register.nameMaxError'))
    .regex(/^[a-zA-Z0-9\u4e00-\u9fa5_-]+$/, t('auth.register.nameFormatError')),
  email: z.string()
    .email(t('auth.register.emailError'))
    .max(100, t('auth.register.emailMaxError')),
  password: z.string()
    .min(8, t('auth.register.passwordError'))
    .max(100, t('auth.register.passwordMaxError'))
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, t('auth.register.passwordFormatError')),
  confirmPassword: z.string()
    .min(8, t('auth.register.confirmPasswordError')),
  agreeToTerms: z.boolean().refine(val => val === true, {
    message: t('auth.register.agreeToTermsError')
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: t('auth.register.passwordMismatchError'),
  path: ["confirmPassword"]
});

type RegisterFormValues = z.infer<ReturnType<typeof createRegisterSchema>>;

const RegisterForm = () => {
  const { t } = useTranslation();
  const { registerWithOtp } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // 🔥 创建 schema 的工厂函数，避免每次渲染都重新创建使用 useMemo 缓存 schema，只在 t 函数变化时重新创建
  const registerSchema = useMemo(() => createRegisterSchema(t), [t]);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      agreeToTerms: false,
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      await registerWithOtp(values.name, values.email, values.password);
    } catch (error) {
      console.error('Registration error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4" >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.register.name')}</FormLabel>
              <FormControl>
                <Input 
                  placeholder={t('auth.register.namePlaceholder')} 
                  maxLength={50}
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.register.email')}</FormLabel>
              <FormControl>
                <Input 
                  type="email"
                  placeholder={t('auth.register.emailPlaceholder')} 
                  maxLength={100}
                  {...field} 
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
              <FormLabel>{t('auth.register.password')}</FormLabel>
              <FormControl>
                <PasswordInput
                  placeholder={t('auth.register.passwordPlaceholder')}
                  maxLength={100}
                  {...field}
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
              <FormLabel>{t('auth.register.confirmPassword')}</FormLabel>
              <FormControl>
                <PasswordInput
                  placeholder={t('auth.register.confirmPasswordPlaceholder')}
                  maxLength={100}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="agreeToTerms"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="text-sm">
                  {t('auth.register.agreeToTermsText')}{' '}
                  <a 
                    href="#/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-black underline hover:text-gray-700"
                  >
                    {t('auth.register.termsOfService')}
                  </a>
                  {' '}{t('auth.register.and')}{' '}
                  <a 
                    href="#/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-black underline hover:text-gray-700"
                  >
                    {t('auth.register.privacyPolicy')}
                  </a>
                </FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <Button 
          type="submit" 
          className="w-full bg-black hover:bg-gray-800 text-white" 
          disabled={isLoading}
        >
          {isLoading ? t('auth.register.registerButtonLoading') : t('auth.register.registerButton')}
        </Button>
      </form>
    </Form>
  );
};

export default RegisterForm;
