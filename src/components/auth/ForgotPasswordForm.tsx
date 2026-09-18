
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';

interface ForgotPasswordFormProps {
  onBack: () => void;
}

const ForgotPasswordForm = ({ onBack }: ForgotPasswordFormProps) => {
  const { t } = useTranslation();
  const { forgotPassword, isLoading } = useAuth();

  const forgotPasswordSchema = z.object({
    email: z.string().email(t('auth.forgotPassword.emailError')),
  });

  type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    try {
      await forgotPassword(values.email);
    } catch (error) {
      console.error('Forgot password error:', error);
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold">{t('auth.forgotPassword.title')}</h3>
        <p className="text-sm text-gray-600 mt-2">
          {t('auth.forgotPassword.subtitle')}
        </p>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.forgotPassword.email')}</FormLabel>
                <FormControl>
                  <Input 
                    type="email"
                    placeholder={t('auth.forgotPassword.emailPlaceholder')} 
                    {...field} 
                    disabled={isLoading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <Button type="submit" className="w-full bg-black hover:bg-gray-800 text-white" disabled={isLoading}>
            {isLoading ? t('auth.forgotPassword.sendButtonLoading') : t('auth.forgotPassword.sendButton')}
          </Button>
          
          <div className="text-center">
            <button
              type="button"
              onClick={onBack}
              className="text-sm text-gray-600 hover:underline"
            >
              {t('auth.forgotPassword.backToLogin')}
            </button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default ForgotPasswordForm;
