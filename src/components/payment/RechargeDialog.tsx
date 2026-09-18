
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { AlipayService } from '@/services/payment/AlipayService';
import { CloudAuthService } from '@/services/cloud/CloudAuthService';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface RechargeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRechargeSuccess?: () => void;
}

const PRESET_AMOUNTS = [10, 50, 100, 200, 500];

export const RechargeDialog: React.FC<RechargeDialogProps> = ({
  open,
  onOpenChange,
  onRechargeSuccess
}) => {
  const { t } = useTranslation();
  const [amountYuan, setAmountYuan] = useState<number>(10);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [discountRate, setDiscountRate] = useState<number>(1);

  // 🔥 打开弹窗时拉取用户折扣（服务端订单创建时才是权威计算，这里只做展示）
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    CloudAuthService.getProfile().then(result => {
      if (cancelled) return;
      const rate = result.success ? result.user?.discount_rate : undefined;
      if (typeof rate === 'number' && rate > 0 && rate < 1) {
        setDiscountRate(rate);
      } else {
        setDiscountRate(1);
      }
    }).catch(() => {
      if (!cancelled) setDiscountRate(1);
    });
    return () => { cancelled = true; };
  }, [open]);

  const hasDiscount = discountRate < 1;
  // 折扣显示值：0.5 → "5"、0.75 → "7.5"（中文“已享X折”）；英文侧用 off 百分比
  const zheLabel = Math.round(discountRate * 100) / 10;
  const offPercent = Math.round((1 - discountRate) * 100);

  const handlePresetAmount = (amount: number) => {
    setAmountYuan(amount);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      setAmountYuan(numValue);
    }
  };

  const handleRecharge = async () => {
    console.log('🚀 [RECHARGE-DIALOG] 开始充值流程:', { amountYuan, timestamp: new Date().toISOString() });

    if (amountYuan <= 0) {
      toast.error(t('payment.rechargeDialog.error.invalidAmount'));
      return;
    }

    if (amountYuan < 1) {
      toast.error(t('payment.rechargeDialog.error.minAmount'));
      return;
    }

    if (amountYuan > 10000) {
      toast.error(t('payment.rechargeDialog.error.maxAmount'));
      return;
    }

    setIsLoading(true);

    try {
      console.log('🔥 [RECHARGE-DIALOG] 开始创建充值订单:', { amountYuan });

      const orderData = await AlipayService.createRechargeOrder(amountYuan);
      
      console.log('✅ [RECHARGE-DIALOG] 充值订单创建成功，准备跳转支付');

      // 验证支付链接
      if (!orderData.paymentUrl) {
        throw new Error(t('payment.rechargeDialog.error.paymentUrl'));
      }
      
      // 跳转到支付页面
      AlipayService.redirectToPayment(orderData.paymentUrl);
      
      // 提示用户
      toast.success(t('payment.rechargeDialog.error.redirect'));
      
      // 通知父组件
      onRechargeSuccess?.();
      
      // 只在成功时关闭弹窗
      onOpenChange(false);

    } catch (error) {
      console.error('❌ [RECHARGE-DIALOG] 创建充值订单失败:', error);
      
      let errorMessage = t('payment.rechargeDialog.error.orderFailed');
      
      if (error instanceof Error) {
        if (error.message.includes('用户未登录')) {
          errorMessage = t('payment.rechargeDialog.error.notLoggedIn');
        } else if (error.message.includes('配置')) {
          errorMessage = t('payment.rechargeDialog.error.configError');
        } else if (error.message.includes('网络')) {
          errorMessage = t('payment.rechargeDialog.error.networkError');
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
      // 错误时不关闭弹窗，让用户可以重试
      
    } finally {
      setIsLoading(false);
    }
  };

  const beAmount = Math.floor(amountYuan / discountRate); // 1元 = 1BE，折扣用户按折后积分展示（与服务端订单计算一致）

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('payment.rechargeDialog.title')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* 预设金额 */}
          <div>
            <Label className="text-sm font-medium mb-3 block">{t('payment.rechargeDialog.selectAmount')}</Label>
            <div className="grid grid-cols-5 gap-2">
              {PRESET_AMOUNTS.map((amount) => (
                <Button
                  key={amount}
                  variant={amountYuan === amount && !customAmount ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePresetAmount(amount)}
                  className="text-xs"
                >
                  ¥{amount}
                </Button>
              ))}
            </div>
          </div>

          {/* 自定义金额 */}
          <div>
            <Label htmlFor="customAmount" className="text-sm font-medium mb-2 block">
              {t('payment.rechargeDialog.customAmount')}
            </Label>
            <Input
              id="customAmount"
              type="number"
              placeholder={t('payment.rechargeDialog.customAmountPlaceholder')}
              value={customAmount}
              onChange={(e) => handleCustomAmountChange(e.target.value)}
              min="1"
              max="10000"
              step="0.01"
            />
          </div>

          {/* 充值信息 */}
          <div className="bg-blue-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('payment.rechargeDialog.amount')}</span>
              <span className="font-medium">¥{amountYuan.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('payment.rechargeDialog.credits')}</span>
              {hasDiscount ? (
                <span className="flex items-center gap-2">
                  <span className="line-through text-gray-400">{Math.floor(amountYuan)}</span>
                  <span className="font-medium text-blue-600">{beAmount} Credits</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                    {t('payment.rechargeDialog.discountBadge', { zhe: zheLabel, off: offPercent })}
                  </span>
                </span>
              ) : (
                <span className="font-medium text-blue-600">{beAmount} Credits</span>
              )}
            </div>
          </div>

          {/* 支付按钮 */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isLoading}
            >
              {t('payment.rechargeDialog.cancel')}
            </Button>
            <Button
              onClick={handleRecharge}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              disabled={isLoading || amountYuan <= 0}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('payment.rechargeDialog.creatingOrder')}
                </>
              ) : (
                t('payment.rechargeDialog.alipay')
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
