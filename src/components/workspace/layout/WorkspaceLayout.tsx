import React from 'react';
import AuthModal from '@/components/auth/AuthModal';

interface WorkspaceLayoutProps {
  workspace?: any;
  handlers?: any;
  children?: React.ReactNode;
}

const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({ children }) => {
  return (
    <>
      <div className="h-screen flex flex-col bg-gray-50">
        <main className="flex-1 min-h-0">
          <div className="h-full w-full">
            {children}
          </div>
        </main>
      </div>
      
      <AuthModal />
    </>
  );
};

export default WorkspaceLayout;
