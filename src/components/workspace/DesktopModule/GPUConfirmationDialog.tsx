import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';

interface GPUConfirmationDialogProps {
  showConfirmation: boolean;
  estimatedCost?: number;
  estimatedDuration?: number;
  costPerMinute?: number;
  isAdjusted?: boolean;
  userBalance?: number; // 用户当前余额
  onConfirm: () => void;
  onCancel: () => void;
  onRecharge?: () => void; // 去充值回调
}

const GPUConfirmationDialog: React.FC<GPUConfirmationDialogProps> = ({
  showConfirmation,
  estimatedCost,
  estimatedDuration,
  costPerMinute,
  isAdjusted = false,
  userBalance = 0,
  onConfirm,
  onCancel,
  onRecharge
}) => {
  const { t } = useTranslation();

  if (!showConfirmation || costPerMinute === undefined) {
    return null;
  }

  // 检查余额是否足够（按最低预估费用 5 分钟计算）
  const minEstimatedCost = (costPerMinute || 0) * 5;
  const hasEnoughBalance = userBalance >= minEstimatedCost;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-200">
        <h3 className="text-lg font-bold mb-3 text-gray-900 flex items-center gap-2">
          {isAdjusted ? (
            <span className="text-orange-600">⚠️ {t('workspace.desktopModule.gpuTrainingStatus.resourceBusyTitle')}</span>
          ) : (
            <span className="flex items-center gap-2">🚀 {t('workspace.desktopModule.gpuTrainingStatus.title')}</span>
          )}
        </h3>

        <div className="space-y-2 mb-4">
          <div className="flex justify-between border-b border-gray-50 pb-2">
            <span className="text-sm text-gray-500">{t('workspace.desktopModule.gpuTrainingStatus.learningRate')}:</span>
            <span className="font-semibold text-gray-800 text-sm inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-violet-500" />{((costPerMinute || 0) * 60).toFixed(2)}/小时</span>
          </div>
          {/* 🔥 显示用户余额（Sparkles 积分，与 ChatHeader 一致） */}
          <div className="flex justify-between border-b border-gray-50 pb-2">
            <span className="text-sm text-gray-500">当前余额:</span>
            <span className={`font-semibold text-sm inline-flex items-center gap-1 ${userBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
              <Sparkles className="h-3.5 w-3.5 text-violet-500" /> {userBalance.toFixed(2)}
              {userBalance < 0 && <span className="text-xs ml-1">(欠费)</span>}
            </span>
          </div>
        </div>

        {/* 🔥 余额不足提示 */}
        {!hasEnoughBalance && (
          <div className="bg-red-50 border-l-4 border-red-500 p-3 mb-4 rounded-r-md">
            <p className="text-sm text-red-700 font-medium mb-2 inline-flex items-center gap-1">
              ⚠️ 余额不足！当前余额 <Sparkles className="h-3.5 w-3.5" /> {userBalance.toFixed(2)}
            </p>
            {onRecharge && (
              <button
                onClick={onRecharge}
                className="text-sm text-blue-600 hover:text-blue-800 underline font-medium"
              >
                💳 去充值
              </button>
            )}
          </div>
        )}

        {isAdjusted ? (
          <div className="bg-orange-50 border-l-4 border-orange-400 p-3 mb-4 rounded-r-md">
            <p className="text-xs text-orange-700 font-medium leading-relaxed">
              {t('workspace.desktopModule.gpuTrainingStatus.resourceAdjustmentNotice')}
            </p>
          </div>
        ) : (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-4 rounded-r-md">
            <p className="text-xs text-blue-700 leading-relaxed">
              {t('workspace.desktopModule.gpuTrainingStatus.billingNotice')}
            </p>
          </div>
        )}

        <div className="flex space-x-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium active:scale-95"
          >
            {t('workspace.desktopModule.codeEditor.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={!hasEnoughBalance}
            className={`flex-1 py-2.5 px-4 rounded-lg transition-all font-bold shadow-md active:scale-95 ${
              hasEnoughBalance
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
            }`}
          >
            {hasEnoughBalance
              ? t('workspace.desktopModule.gpuTrainingStatus.startTraining')
              : '余额不足'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GPUConfirmationDialog;
