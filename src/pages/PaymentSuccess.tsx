
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

interface OrderInfo {
  orderNo: string;
  totalAmount: string;
  tradeNo: string | null;
  timestamp: string;
}

const PaymentSuccess: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);

  useEffect(() => {
    // 从URL参数获取订单信息
    const searchParams = new URLSearchParams(location.search);
    const orderNo = searchParams.get('out_trade_no');
    const totalAmount = searchParams.get('total_amount');
    const tradeNo = searchParams.get('trade_no');

    if (orderNo && totalAmount) {
      setOrderInfo({
        orderNo,
        totalAmount,
        tradeNo,
        timestamp: new Date().toLocaleString('zh-CN')
      });
    }

    // 尝试自动关闭页面（浏览器可能会阻止）
    const closePage = () => {
      try {
        window.close();
      } catch (e) {
        console.log('无法自动关闭页面，浏览器安全限制');
      }
    };

    // 5秒后尝试关闭页面
    const timer = setTimeout(closePage, 8000);

    return () => clearTimeout(timer);
  }, [location]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="overflow-hidden">
          <CardHeader className="bg-green-50 text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">
                支付成功
              </CardTitle>
              <p className="text-muted-foreground mt-2">
                您的订单已支付完成，感谢您的使用
              </p>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {orderInfo && (
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">订单编号</span>
                  <span className="font-medium text-foreground">{orderInfo.orderNo}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">交易编号</span>
                  <span className="font-medium text-foreground">{orderInfo.tradeNo || '待生成'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">支付金额</span>
                  <span className="text-lg font-bold text-green-600">¥{orderInfo.totalAmount}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-muted-foreground">支付时间</span>
                  <span className="font-medium text-foreground">{orderInfo.timestamp}</span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Button
                className="w-full"
                onClick={() => navigate('/profile')}
              >
                查看订单
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/')}
              >
                返回首页
              </Button>
            </div>
          </CardContent>

          <div className="bg-muted p-4 text-center border-t">
            <p className="text-sm text-muted-foreground">
              支付成功！页面将在8秒后尝试自动关闭
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PaymentSuccess;
