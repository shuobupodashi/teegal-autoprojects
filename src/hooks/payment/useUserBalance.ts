
import { useState, useEffect } from 'react';
import { BalanceService } from '@/services/BalanceService';
import { useAuth } from '@/context/AuthContext';

export const useUserBalance = () => {
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const fetchBalance = async () => {
    if (!user) {
      setBalance(0);
      setIsLoading(false);
      return;
    }

    try {
      const userBalance = await BalanceService.getBalance(user.id);
      setBalance(userBalance);
    } catch (error) {
      console.error('获取用户余额异常:', error);
      setBalance(0);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshBalance = () => {
    fetchBalance();
  };

  useEffect(() => {
    fetchBalance();
  }, [user]);

  return {
    balance,
    isLoading,
    refreshBalance
  };
};
