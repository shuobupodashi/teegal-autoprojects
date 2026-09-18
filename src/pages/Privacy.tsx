
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Link to="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回首页
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-foreground mb-2">隐私政策</h1>
          <p className="text-muted-foreground">最后更新时间：2026年8月31日</p>
        </div>

        <div className="prose prose-lg max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. 软件架构与数据处理方式</h2>
            <div className="text-muted-foreground leading-relaxed space-y-2">
              <p>Teegal 是一款<strong>本地电脑平台软件</strong>。除本政策明确说明的云端功能外，软件的核心功能（包括对话记录、项目文件、训练代码、本地模型等）均在您的本地计算机上运行和存储。</p>
              <p><strong>本地数据：</strong>您的对话历史、上传至本地工作区的文件、训练项目与代码等数据默认保存在您自己的电脑上，由您直接控制。我们无法也无意访问您本地存储的这些数据。</p>
              <p><strong>云端服务：</strong>涉及账户认证、会员与付费服务、弹性算力网络、数据集市场、内置模型调用等功能时，相关数据将通过网络与我们的服务器（workbees.space）交互，具体规则见下文。</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. 我们收集的信息</h2>
            <div className="text-muted-foreground leading-relaxed space-y-2">
              <p><strong>账户信息：</strong>注册时收集的邮箱地址、昵称等基本信息。</p>
              <p><strong>付费与交易信息：</strong>充值记录、余额与消费流水（用于计费和提供账单服务）。</p>
              <p><strong>技术信息：</strong>IP 地址、设备信息、软件版本等服务日志。</p>
              <p><strong>云端文件信息：</strong>您主动上传至云端存储（用于训练或对话引用）的文件的元数据（文件名、大小、存储地址），以及文件内容本身（仅在您选择上传时）。</p>
              <p><strong>使用数据：</strong>服务使用频率、功能使用情况等统计数据。</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. 弹性算力与数据处理</h2>
            <div className="text-muted-foreground leading-relaxed space-y-2">
              <p>当您使用弹性算力网络进行模型训练或推理时：</p>
              <p>• 您指定的训练任务（含被您选择上传或引用的数据）将在云端容器实例中处理，任务结束后相关容器将按服务策略释放。</p>
              <p>• 训练产生的模型与结果文件将存储于您账户关联的云端存储空间，或下载至您的本地计算机。</p>
              <p>• <strong>请您自行评估并决定</strong>是否将敏感数据提交云端处理；一旦您主动选择上传，即视为您同意该数据在云端算力环境中被处理。</p>
              <p>• 算力服务可能由第三方云服务商（如阿里云等）的实际基础设施承载，我们将通过合同等方式要求其履行数据保护义务。</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. 内置模型与第三方模型</h2>
            <div className="text-muted-foreground leading-relaxed space-y-2">
              <p><strong>内置模型：</strong>您使用软件内置的模型服务时，需要发送给模型的对话内容将经由我们的服务器转发至相应的模型提供方，以完成请求。我们仅在转发所必需的范围内处理这些内容。</p>
              <p><strong>自定义模型：</strong>您自行配置第三方模型（填写 API 密钥等）的，您的请求将直接与该第三方服务交互，受该第三方服务自身的隐私政策约束。请您妥善保管自己的密钥，我们不对第三方服务的数据处理行为承担责任。</p>
              <p><strong>不用于训练：</strong>未经您的明确同意，我们不会将您的对话内容或上传数据用于训练我们自己的模型。</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. 信息使用</h2>
            <div className="text-muted-foreground leading-relaxed space-y-2">
              <p>• 提供和维护软件功能、云端服务与客户支持</p>
              <p>• 账户管理、计费结算与服务购买（如数据集购买）</p>
              <p>• 安全防护、欺诈检测与故障排查</p>
              <p>• 产品统计分析与服务质量改进（在可行范围内采用匿名化、聚合化处理）</p>
              <p>• 遵守法律法规的要求</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. 信息共享</h2>
            <div className="text-muted-foreground leading-relaxed space-y-2">
              <p><strong>我们不会出售您的个人信息。</strong>仅在以下情况下可能共享信息：</p>
              <p>• 获得您的明确同意</p>
              <p>• 法律法规要求或执法、司法机关的合法要求</p>
              <p>• 为提供服务所必需的第三方（如云服务商、支付渠道），且仅共享必要信息</p>
              <p>• 保护我们或他人的合法权益所必需</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. 数据安全与本地数据责任</h2>
            <div className="text-muted-foreground leading-relaxed space-y-2">
              <p>• 我们对服务器端数据采用行业标准的加密传输和访问控制保护。</p>
              <p>• <strong>本地数据的备份与安全由您自行负责。</strong>由于本地数据存储在您的计算机上，您应自行做好备份、防病毒与设备安全措施。因您的设备故障、误删除、病毒感染等造成的本地数据损失，我们不承担责任。</p>
              <p>• 您卸载软件可能清除本地数据，请在卸载前自行确认已完成备份。</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. 您的权利</h2>
            <div className="text-muted-foreground leading-relaxed space-y-2">
              <p>• <strong>访问与更正：</strong>查看和修改您的账户信息</p>
              <p>• <strong>删除：</strong>申请删除云端存储的您的个人信息和文件</p>
              <p>• <strong>数据导出：</strong>获取云端数据的副本</p>
              <p>• <strong>本地数据：</strong>本地数据由您直接掌握，您可随时在软件内或通过操作系统自行管理、导出或删除</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. 未成年人保护</h2>
            <p className="text-muted-foreground leading-relaxed">
              本软件及云端服务面向成年用户。未成年人应在监护人指导和同意下使用。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. 政策变更与联系我们</h2>
            <div className="text-muted-foreground leading-relaxed space-y-2">
              <p>我们可能不时更新本政策，重大变更将通过软件或官网公告。继续使用即表示您接受更新后的政策。</p>
              <p>
                如对本政策有任何疑问或需要行使您的权利，请联系我们：
                <br />
                官网：workbees.space
                <br />
                邮箱：privacy@workbees.space
                <br />
                我们将在 30 天内回复您的请求。
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
