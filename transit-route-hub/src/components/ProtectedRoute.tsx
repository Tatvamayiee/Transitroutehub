import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Capability, UserRole } from '../types';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: UserRole[];
  capability?: Capability;
}

export function ProtectedRoute({ children, roles, capability }: ProtectedRouteProps) {
  const { user, initializing, hasCapability } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 rounded-full border-4 border-teal/30 border-t-teal animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (capability && !hasCapability(capability)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}