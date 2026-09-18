import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Coins, Plus, History } from 'lucide-react';
import { RechargeDialog } from './RechargeDialog';
import { RechargeHistory } from './RechargeHistory';
import { BalanceService } from '@/services/BalanceService';
import { CloudPaymentService } from '@/services/cloud/CloudPaymentService';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

import { useTranslation } from 'react-i18next';

interface BalanceDisplayProps {
  balance: number;
  onBalanceUpdate?: () => void;
  showRechargeButton?: boolean;
  showHistoryButton?: boolean;
  className?: string;
  // 新增外部状态控制选项
  onRechargeClick?: () => void;
  onHistoryClick?: () => void;
}

export const BalanceDisplay: React.FC<BalanceDisplayProps> = ({
  balance,
  onBalanceUpdate,
  showRechargeButton = true,
  showHistoryButton = false,
  className = '',
  onRechargeClick,
  onHistoryClick
}) => {
  const { t } = useTranslation();
  const [showRechargeDialog, setShowRechargeDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // 🔥 新增：支付成功Toast通知
  useEffect(() => {
    const checkRecentPayment = async () => {
      if (!user?.id) return;

      try {
        // 检查最近5分钟内的成功支付记录
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        // 使用 CloudPaymentService 查询余额
        const result = await CloudPaymentService.getLogs();
        
        if (result.success && result.logs) {
          // 过滤最近5分钟内的充值记录
          const recentPayments = result.logs.filter(log => 
            log.type === 'recharge' && 
            new Date(log.createdAt) >= fiveMinutesAgo
          ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          if (recentPayments.length > 0) {
            const payment = recentPayments[0];
            const storageKey = `payment-notified-${payment.id}`;
            
            // 检查是否已经显示过通知
            if (!localStorage.getItem(storageKey)) {
              // 显示15秒长时间Toast
              toast({
                title: "💰 充值成功！",
                description: `您已成功充值 ${payment.amount} BE，余额已到账`,
                duration: 15000, // 15秒
              });
              
              // 标记为已通知，避免重复显示
              localStorage.setItem(storageKey, 'true');
            }
          }
        }
      } catch (error) {
        console.error('检查最近支付记录失败:', error);
      }
    };

    // 页面可见性变化时检查
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkRecentPayment();
      }
    };

    // 监听页面可见性
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // 组件挂载时也检查一次
    checkRecentPayment();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id, toast]);

  const handleRechargeSuccess = () => {
    onBalanceUpdate?.();
  };

  const handleRechargeButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('💰 [BALANCE-DISPLAY] 充值按钮被点击');
    
    if (onRechargeClick) {
      // 使用外部控制
      onRechargeClick();
    } else {
      // 使用内部状态
      setShowRechargeDialog(true);
    }
  };

  const handleHistoryButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('📜 [BALANCE-DISPLAY] 历史按钮被点击');
    
    if (onHistoryClick) {
      // 使用外部控制
      onHistoryClick();
    } else {
      // 使用内部状态
      setShowHistoryDialog(true);
    }
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full">
          <Coins className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-blue-700">
            {balance} 
          </span>
        </div>
        
        {showRechargeButton && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRechargeButtonClick}
            className="h-7 px-2"
          >
            <Plus className="w-4 h-4 mr-1" />
            {t("payment.recharge")}
          </Button>
        )}
        
        {showHistoryButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleHistoryButtonClick}
            className="h-7 px-2"
          >
            <History className="w-4 h-4 mr-1" />
            {t("payment.history")}
          </Button>
        )}
      </div>

      {/* 只有在没有外部控制时才渲染内部弹窗 */}
      {!onRechargeClick && (
        <RechargeDialog
          open={showRechargeDialog}
          onOpenChange={setShowRechargeDialog}
          onRechargeSuccess={handleRechargeSuccess}
        />
      )}
      
      {!onHistoryClick && (
        <RechargeHistory
          open={showHistoryDialog}
          onOpenChange={setShowHistoryDialog}
        />
      )}
    </div>
  );
};
