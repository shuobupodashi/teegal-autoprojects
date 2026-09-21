import React, { useEffect, useRef } from "react";
import WorkspaceLayout from "../layout/WorkspaceLayout";
import WorkspaceGrid from "../layout/WorkspaceGrid";
import { useWorkspace } from "@/hooks/workspace/useWorkspace";
import { createHandlers } from "@/hooks/workspace/useWorkspaceHandlers";
import { UserProfile } from "@/context/AuthContext";

interface AuthenticatedWorkspaceProps {
  user: UserProfile | any;
}

const AuthenticatedWorkspace: React.FC<AuthenticatedWorkspaceProps> = ({ user }) => {
  const workspace = useWorkspace();
  const handlers = createHandlers(workspace);

  // 🔥 Headless 分身桥：订阅主进程转发的 agent query（POST /api/agent/query → IPC），
  // 复用与聊天输入框完全相同的编排（handleSendMessage → SummaryHandler 内核）。
  // 仅 Electron headless 模式订阅；受理即回包，执行过程在分身内进行。
  const sendRef = useRef(handlers.handleSendMessage);
  sendRef.current = handlers.handleSendMessage;

  useEffect(() => {
    const electron = (window as any).electron;
    if (!electron?.isHeadless || !electron?.onAgentQuery) return;

    const unsub = electron.onAgentQuery(({ reqId, userQuery }: { reqId: string; userQuery: string }) => {
      console.log(`🧬 [AGENT-BRIDGE] 收到 agent query: ${userQuery.slice(0, 80)}...`);
      try {
        // 受理即回包（不阻塞 HTTP 响应等执行完成——执行结果经项目文件/GPU任务回流）
        sendRef.current(userQuery).catch((e: any) => {
          console.error('❌ [AGENT-BRIDGE] 执行编排异常:', e);
        });
        electron.agentQueryResult({ reqId, ok: true });
      } catch (e: any) {
        console.error('❌ [AGENT-BRIDGE] 受理失败:', e);
        electron.agentQueryResult({ reqId, ok: false, error: e?.message || '受理失败' });
      }
    });
    console.log('🧬 [AGENT-BRIDGE] Headless agent query 桥已订阅');
    return unsub;
  }, []);

  return (
    <WorkspaceLayout>
      <WorkspaceGrid
        messages={workspace.messages}
        isProcessing={workspace.isProcessing}
        currentConversationId={workspace.currentConversationId}
        userId={workspace.userId}
        onLoadMoreMessages={handlers.handleLoadMoreMessages}
        onSendMessage={handlers.handleSendMessage}
        onNewChat={handlers.handleNewChat}
        onCancel={handlers.handleCancel}
      />
    </WorkspaceLayout>
  );
};

export default AuthenticatedWorkspace;
