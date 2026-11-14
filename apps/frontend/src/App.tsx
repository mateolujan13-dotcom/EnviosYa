import { RolUsuario } from '@envioya/shared';
import { Navigate, Route, Routes } from 'react-router-dom';
import { GuestRoute, ProtectedRoute } from './auth/Routes';
import { useAuth } from './auth/AuthContext';
import { homeForRole } from './auth/roleHome';
import { FullScreenLoader } from './components/FullScreenLoader';
import { ClientDashboardPage } from './pages/ClientDashboardPage';
import { LoginPage } from './pages/LoginPage';
import { OpsDashboardPage } from './pages/OpsDashboardPage';
import { RegisterPage } from './pages/RegisterPage';

function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return <FullScreenLoader />;
  }

  return (
    <Navigate to={user ? homeForRole(user.rol) : '/login'} replace />
  );
}

export const App = () => {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />

      <Route
        path="/login"
        element={
          <GuestRoute>
            <LoginPage />
          </GuestRoute>
        }
      />

      <Route
        path="/register"
        element={
          <GuestRoute>
            <RegisterPage />
          </GuestRoute>
        }
      />

      <Route
        path="/app"
        element={
          <ProtectedRoute allowedRoles={[RolUsuario.CLIENTE]}>
            <ClientDashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/ops"
        element={
          <ProtectedRoute allowedRoles={[RolUsuario.OPERADOR, RolUsuario.ADMIN]}>
            <OpsDashboardPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
};
