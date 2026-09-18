/**
 * Training Toast Manager
 * GPU 训练任务状态展示
 */

import React from 'react';
import { toast } from 'sonner';

export const showTrainingStatus = (message: string, type: 'loading' | 'success' | 'error' = 'loading') => {
  const icons = {
    loading: '⏳',
    success: '✅',
    error: '❌',
  };

  if (type === 'loading') {
    return toast.loading(`${icons[type]} ${message}`, {
      duration: Infinity,
    });
  } else if (type === 'error') {
    return toast.error(`${icons[type]} ${message}`, {
      duration: 5000,
    });
  } else {
    return toast.success(`${icons[type]} ${message}`, {
      duration: 3000,
    });
  }
};

export const dismissTrainingToast = (toastId?: string | number) => {
  if (toastId) {
    toast.dismiss(toastId);
  } else {
    toast.dismiss();
  }
};

export default {
  showTrainingStatus,
  dismissTrainingToast,
};