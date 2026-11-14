import { RolUsuario } from '@envioya/shared';
import { Navigate, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { homeForRole } from './roleHome';
import { FullScreenLoader } from '../components/FullScreenLoader';

interface ProtectedRouteProps {
  allowedRoles: RolUsuario[];
  children: ReactNode;
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (!allowedRoles.includes(user.rol)) {
    return <Navigate to={homeForRole(user.rol)} replace />;
  }

  return <>{children}</>;
}

export function GuestRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (user) {
    return <Navigate to={homeForRole(user.rol)} replace />;
  }

  return <>{children}</>;
}
