
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Terms = () => {
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
          <h1 className="text-3xl font-bold text-foreground mb-2">服务条款</h1>
          <p className="text-muted-foreground">最后更新时间：2026年8月31日</p>
        </div>

        <div className="prose prose-lg max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. 服务说明</h2>
            <div className="text-muted-foreground leading-relaxed space-y-2">
              <p>Teegal（由 workbees.space 运营，以下简称"本软件"或"我们"）是一款安装在您本地电脑上的 AI 平台软件，提供智能对话、代码执行、模型训练与管理等功能。</p>
              <p><strong>本地服务：</strong>软件的对话、项目、文件与代码执行等核心功能在您的本地计算机上运行，相关数据默认存储在本地。</p>
              <p><strong>云端服务：</strong>账户认证、会员与计费、弹性算力网络（云端模型训练与推理）、数据集市场、内置模型调用等，通过我们的服务器（workbees.space）提供，需要网络连接。</p>
              <p>通过注册账户或使用本软件，您同意遵守本服务条款。</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. 用户账户</h2>
            <div className="text-muted-foreground leading-relaxed space-y-2">
              <p>• 您必须提供准确、完整的注册信息，并对账户下的所有活动负责</p>
              <p>• 您有责任妥善保管账户密码及 API 密钥等凭据</p>
              <p>• 一个邮箱地址只能注册一个账户</p>
              <p>• 您必须年满 18 周岁，或在监护人同意下使用本软件</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. 付费服务与计费</h2>
            <div className="text-muted-foreground leading-relaxed space-y-2">
              <p>• <strong>账户余额：</strong>您可以充值获得账户余额，用于消费云端服务（弹性算力、内置模型、数据集等）。余额不可提现、不可转让。</p>
              <p>• <strong>弹性算力：</strong>按实际用量计费，费用以结算页面向您展示的价目为准。您启动云端任务前应确认预估费用。</p>
              <p>• <strong>内置模型：</strong>通过我们接入的模型服务（国内外主流大模型等）按用量计费，费用在调用前向您展示或按公开价目结算。</p>
              <p>• <strong>数据集购买：</strong>数据集为数字内容商品，购买成功即完成交付（获得访问/下载权限），<strong>除法律另有规定外不支持退款</strong>。请购买前仔细阅读数据集的描述信息。</p>
              <p>• 我们可能调整价格与服务方案，调整前已生效的订单不受影响，价格调整将通过适当方式公告。</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. 用户内容与数据集使用规范</h2>
            <div className="text-muted-foreground leading-relaxed space-y-2">
              <p>• <strong>权利担保：</strong>您在软件中上传、处理或用于训练的所有数据，应确保您拥有合法的权利或授权。因您使用无权使用的数据引发的任何纠纷与责任，由您自行承担。</p>
              <p>• <strong>合法用途：</strong>禁止上传、处理涉及危害国家安全、侵犯他人合法权益、违反法律法规的数据与内容。</p>
              <p>• <strong>数据集许可：</strong>平台数据集市场提供的数据集仅供您在软件内用于学习、研究与训练等用途，不得转售、再分发或用于其他商业性再授权。</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. AI 服务使用规范</h2>
            <div className="text-muted-foreground leading-relaxed space-y-2">
              <p>• 禁止使用本软件生成违法、有害或侵犯他人权利的内容</p>
              <p>• 不得利用本软件从事欺诈、攻击计算机系统等违法活动</p>
              <p>• 尊重知识产权，包括第三方模型服务的使用条款</p>
              <p>• <strong>AI 生成内容仅供参考</strong>，不构成任何专业意见。您应对 AI 生成的代码、分析结果与模型输出自行判断并承担使用后果。</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. 模型训练特别声明</h2>
            <div className="text-muted-foreground leading-relaxed space-y-2">
              <p>• 您使用弹性算力网络训练的模型归您所有，您对其使用与分发负责。</p>
              <p>• <strong>训练效果不保证：</strong>模型的性能受数据质量、参数设置、算力资源等多种因素影响，我们不保证任何训练任务能达到特定效果或指标。</p>
              <p>• <strong>领域数据特别提示：</strong>平台提供的医疗、金融（如股票行情）、蛋白质结构等数据集仅用于技术研究与学习，<strong>不得用于医疗诊断、投资决策等实际用途</strong>。基于此类数据训练的模型产生的任何输出均不构成专业建议。</p>
              <p>• 云端训练任务可能因资源调度、网络或第三方云服务故障等原因中断，我们将按实际未完成的用量处理费用，但不承担由此造成的间接损失。</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. 第三方服务</h2>
            <div className="text-muted-foreground leading-relaxed space-y-2">
              <p>• 本软件的部分功能依赖第三方服务（如云服务商、第三方模型提供方）。您使用自定义模型（自带 API 密钥）时，直接与相应第三方建立服务关系，受其服务条款约束。</p>
              <p>• 第三方服务的可用性、计费与数据处理由该第三方自行负责，我们不对第三方服务的变更或中断承担责任。</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. 数据和隐私</h2>
            <p className="text-muted-foreground leading-relaxed">
              我们重视您的隐私保护。数据的收集、使用和保护政策请参阅我们的
              <Link to="/privacy" className="text-primary hover:underline mx-1">隐私政策</Link>。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. 知识产权</h2>
            <div className="text-muted-foreground leading-relaxed space-y-2">
              <p>• 本软件及其配套云端服务的软件代码、界面、商标等知识产权归我们或相应权利人所有。</p>
              <p>• 您在软件中创作的内容（包括代码、文档、训练得到的模型）归您所有。</p>
              <p>• 未经授权，您不得对本软件进行反向工程、复制分发或去除权利声明。</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. 免责声明与责任限制</h2>
            <div className="text-muted-foreground leading-relaxed space-y-2">
              <p>• 本软件及云端服务按"现状"提供，我们不对其连续性、准确性、适用性或特定目的的适用性作出明示或默示的保证。</p>
              <p>• 在法律允许的最大范围内，我们不对因使用或无法使用本软件导致的<strong>间接损失、数据损失、利润损失或商业机会损失</strong>承担责任。</p>
              <p>• <strong>本地数据风险自担：</strong>存储于您本地计算机的数据由您自行管理，因设备故障、操作失误等原因造成损失的，我们不承担责任。</p>
              <p>• 若依法需承担责任，我们的累计赔偿责任以您在索赔发生前 12 个月内就本软件向我们实际支付的费用总额为上限。</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. 服务变更与终止</h2>
            <div className="text-muted-foreground leading-relaxed space-y-2">
              <p>• 我们可能对服务的功能、配额与资源策略进行调整，并可能因维护、升级等原因中断服务。</p>
              <p>• 若您违反本条款，我们有权暂停或终止向您提供服务。</p>
              <p>• 服务终止时，您可依法要求导出您的数据；账户注销后我们将依法删除您的个人信息。</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. 条款变更</h2>
            <p className="text-muted-foreground leading-relaxed">
              我们可能不时更新本条款，重大变更将通过软件或官网公告告知。继续使用本软件即表示您同意更新后的条款；若您不同意，应停止使用并可选择注销账户。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. 适用法律与联系我们</h2>
            <div className="text-muted-foreground leading-relaxed space-y-2">
              <p>本条款的订立、执行与解释适用中华人民共和国法律。</p>
              <p>
                如对本条款有任何疑问，请联系我们：
                <br />
                官网：workbees.space
                <br />
                邮箱：support@workbees.space
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Terms;
