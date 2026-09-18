import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlipayService, RechargeOrder } from '@/services/payment/AlipayService';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale/zh-CN';
import { Loader2, RefreshCw } from 'lucide-react';

interface RechargeHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RechargeHistory: React.FC<RechargeHistoryProps> = ({
  open,
  onOpenChange
}) => {
  const [orders, setOrders] = useState<RechargeOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const data = await AlipayService.getUserRechargeOrders();
      setOrders(data);
    } catch (error) {
      console.error('加载充值记录失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadOrders();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              📜 充值记录
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadOrders}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>加载中...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              暂无充值记录
            </div>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className="border border-gray-200 rounded-lg p-4 space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">
                      充值 {AlipayService.formatBE(order.amount_be)}
                    </div>
                    <div className="text-sm text-gray-600">
                      订单号: {order.order_no}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {AlipayService.formatAmount(order.amount_yuan)}
                    </div>
                    <div className={`text-sm ${AlipayService.getStatusColor(order.status)}`}>
                      {AlipayService.getStatusText(order.status)}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between text-xs text-gray-500">
                  <span>
                    创建时间: {formatDistanceToNow(new Date(order.created_at), {
                      addSuffix: true,
                      locale: zhCN
                    })}
                  </span>
                  {order.paid_at && (
                    <span>
                      支付时间: {formatDistanceToNow(new Date(order.paid_at), {
                        addSuffix: true,
                        locale: zhCN
                      })}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
