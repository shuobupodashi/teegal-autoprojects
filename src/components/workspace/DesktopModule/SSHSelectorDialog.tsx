import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Cloud, Loader2, OctagonX, Copy, Check } from 'lucide-react';
import { getBackendUrl } from '@/config/env';
import { sshListActive, sshCloseInstance } from '@/utils/systemtools/sshInstance';

/**
 * 云端常驻实例选择弹窗（长期租赁语义，与 GPUSelectorDialog 的短任务区分）
 * - 上半区：当前活跃实例（可关机，防止重复开机计费）
 * - 下半区：CPU/GPU 规格 + 单价，选中后开机（常驻直到手动关机）
 * 架构原则：本组件只做 React 触点，开机/关机/列表逻辑统一走 sshInstance 核心层
 * （与 LLM ssh_instance 工具同一条链路）。
 * 注：SSH 是底层通道名词，只出现在给 LLM 的工具/凭据描述里，UI 不露出
 */

export interface SshSpecOption {
  gpuType: string;
  gpuCount: number;
  instanceType: string;
  vcpuCount: number;
  memoryGB: number;
  pricePerHour: number;
  pricePerDay: number;
}

/** 活跃实例（本地资源表字段，sync 自愈校正后） */
interface ActiveInstance {
  id: string;                 // cloud_rental_id
  instance_id: string;
  instance_type: string;
  status: string;
  host: string;               // 公网 IP
  username: string;           // 登录用户（镜像决定，ubuntu 为主）
  app_id: string;             // 项目归属（开机登记；空 = 未关联项目）
  price_per_hour: number;
  credential_name: string;    // 对应凭据编号（ssh_ins-xxx）
}

interface SSHSelectorDialogProps {
  isOpen: boolean;
  userBalance: number;
  /** 当前项目 appId（归属标签用：本项目 / 其他项目 / 未关联） */
  currentAppId?: string | null;
  onSelect: (spec: SshSpecOption) => void;
  onCancel: () => void;
  onRecharge?: () => void;
  userId?: string;
}

const SSHSelectorDialog: React.FC<SSHSelectorDialogProps> = ({
  isOpen,
  userBalance,
  currentAppId,
  onSelect,
  onCancel,
  onRecharge,
  userId
}) => {
  const [selectedSpec, setSelectedSpec] = useState<SshSpecOption | null>(null);
  const [specs, setSpecs] = useState<SshSpecOption[]>([]);
  const [activeInstances, setActiveInstances] = useState<ActiveInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 复制 ssh 地址（user@IP，可直接拼连接命令），成功显示对勾 1.5s
  const handleCopyAddress = async (inst: ActiveInstance) => {
    try {
      const addr = `${inst.username || 'ubuntu'}@${inst.host}`;
      await navigator.clipboard.writeText(addr);
      setCopiedId(inst.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (error) {
      console.warn('[SSH-SELECTOR] 复制地址失败:', error);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 规格清单（展示型，直连本地转发）；活跃实例走核心层（带云端自愈校正）
      const [typesResp, active] = await Promise.all([
        fetch(`${getBackendUrl()}/api/rental/types`),
        sshListActive(userId)
      ]);

      if (typesResp.ok) {
        const data = await typesResp.json();
        if (data.success && data.types) {
          setSpecs(data.types.map((t: any) => ({
            gpuType: t.gpuType,
            gpuCount: t.gpuCount,
            instanceType: t.instanceType,
            vcpuCount: t.vcpuCount,
            memoryGB: t.memoryGB,
            pricePerHour: t.pricePerHour,
            pricePerDay: t.pricePerDay
          })).sort((a: SshSpecOption, b: SshSpecOption) => a.pricePerHour - b.pricePerHour));
        }
      }

      if (active.ok) {
        setActiveInstances(active.instances.map((r: any) => ({
          id: r.cloud_rental_id || r.cloud_instance_id,
          instance_id: r.cloud_instance_id || '',
          instance_type: r.instance_type,
          status: r.status,
          host: r.host || '',
          username: r.username || '',
          app_id: r.app_id || '',
          price_per_hour: r.price_per_hour || 0,
          credential_name: r.credential_name || '',
        })));
      }
    } catch (error) {
      console.warn('[SSH-SELECTOR] 获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) {
      setSelectedSpec(null);
      fetchData();
    }
  }, [isOpen, fetchData]);

  // 关机（核心层统一处理：云端结算 + 本地收尾 + 凭据同步删除）
  const handleCloseInstance = async (inst: ActiveInstance) => {
    setClosingId(inst.id);
    try {
      const r = await sshCloseInstance(inst.id, userId);
      if (!r.ok) {
        console.warn('[SSH-SELECTOR] 关机失败:', r.error);
        return;
      }
      await fetchData();
    } catch (error) {
      console.warn('[SSH-SELECTOR] 关机失败:', error);
    } finally {
      setClosingId(null);
    }
  };

  if (!isOpen) return null;

  const hasEnoughBalance = userBalance > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-200 overflow-hidden">

        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Cloud className="h-5 w-5" /> 常驻实例
            {loading && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
          </h3>
          <button
            onClick={onCancel}
            className="p-1.5 -mr-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 max-h-[420px] overflow-y-auto">
          {/* 活跃实例：常驻中，可关机 */}
          {activeInstances.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-medium text-gray-500 mb-2">运行中的实例</div>
              <div className="grid gap-2">
                {activeInstances.map((inst) => (
                  <div key={inst.id} className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      {inst.status === 'running' ? (
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                      ) : (
                        <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                      )}
                      <div>
                        <div className="text-sm font-medium flex items-center gap-1">
                          {inst.host || '开机中...'}
                          {inst.host && (
                            <button
                              onClick={() => handleCopyAddress(inst)}
                              title={`复制 ${inst.username || 'ubuntu'}@${inst.host}`}
                              className="p-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                              {copiedId === inst.id
                                ? <Check className="w-3 h-3 text-green-600" />
                                : <Copy className="w-3 h-3" />}
                            </button>
                          )}
                          <span className="ml-1 text-xs text-gray-500">{inst.instance_type}</span>
                        </div>
                        <div className="text-xs text-gray-500 inline-flex items-center gap-0.5">
                          <Sparkles className="h-3 w-3" />{Number(inst.price_per_hour).toFixed(2)}/小时
                          {/* 归属标签：项目视角下的机器归属（全局列表也能看出关联） */}
                          <span className={`ml-2 text-[10px] px-1.5 py-px rounded-full ${
                            inst.app_id === currentAppId
                              ? 'bg-blue-100 text-blue-700'
                              : inst.app_id
                                ? 'bg-gray-100 text-gray-500'
                                : 'bg-gray-50 text-gray-400 border border-gray-200'
                          }`}>
                            {inst.app_id === currentAppId ? '本项目' : inst.app_id ? '其他项目' : '未关联'}
                          </span>
                          {inst.credential_name && (
                            <span className="ml-2 text-gray-400">凭据: {inst.credential_name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCloseInstance(inst)}
                      disabled={closingId === inst.id}
                      className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-md inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                    >
                      {closingId === inst.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <OctagonX className="w-3 h-3" />}
                      关机
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 规格列表 */}
          <div className="text-xs font-medium text-gray-500 mb-2">开机新实例（CPU / GPU 均可长租）</div>
          <div className="grid gap-2">
            {specs.map((spec) => (
              <button
                key={spec.instanceType}
                onClick={() => setSelectedSpec(spec)}
                className={`p-3 rounded-lg border transition-all ${
                  selectedSpec?.instanceType === spec.instanceType
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-green-200 bg-white hover:border-green-300 hover:bg-green-50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium">
                      {spec.gpuType === 'CPU' ? 'CPU（通用计算）' : `${spec.gpuType} × ${spec.gpuCount}`}
                    </div>
                    <div className="text-xs text-gray-500">
                      {spec.vcpuCount}核 / {spec.memoryGB}GB内存
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-green-600 inline-flex items-center gap-0.5">
                      <Sparkles className="h-3 w-3" />{spec.pricePerHour.toFixed(2)}/时
                    </div>
                    <div className="text-xs text-gray-500">≈ {spec.pricePerDay.toFixed(0)}/天</div>
                  </div>
                </div>
              </button>
            ))}
            {specs.length === 0 && !loading && (
              <div className="text-center text-gray-500 py-6">暂无可租赁规格（云端未发布或加载失败）</div>
            )}
          </div>
        </div>

        {selectedSpec && (
          <div className="p-4 bg-gray-50 border-t border-gray-100">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 inline-flex items-center gap-1">
                当前余额：<span className={`font-bold inline-flex items-center gap-0.5 ${userBalance <= 0 ? 'text-red-600' : 'text-green-600'}`}><Sparkles className="h-3.5 w-3.5 text-violet-500" />{userBalance.toFixed(2)}</span>
              </span>
              <div className="text-sm text-gray-500">
                ⏱️ 开机即计费，关机停止
              </div>
            </div>
            {!hasEnoughBalance && (
              <div className="mt-2 p-2 bg-red-50 border-l-4 border-red-500 rounded-r text-sm text-red-700">
                ⚠️ 余额不足，请先充值
                {onRecharge && (
                  <button onClick={onRecharge} className="ml-2 text-blue-600 underline">
                    去充值
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="p-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium"
          >
            取消
          </button>
          <button
            onClick={() => selectedSpec && onSelect(selectedSpec)}
            disabled={!selectedSpec || !hasEnoughBalance}
            className={`flex-1 py-2.5 px-4 rounded-lg transition-all font-bold ${
              selectedSpec && hasEnoughBalance
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {!selectedSpec ? '请选择实例规格' : !hasEnoughBalance ? '余额不足' : '开机'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SSHSelectorDialog;
