import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import AuthenticatedWorkspace from '@/components/workspace/auth/AuthenticatedWorkspace';

const Workspace = () => {
  const { user } = useAuth();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  return <AuthenticatedWorkspace user={user} />;
};

export default Workspace;
