import React from "react";
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
