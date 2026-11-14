import { lazy, Suspense } from 'react';
import { RolUsuario } from '@envioya/shared';
import { Navigate, Route, Routes } from 'react-router-dom';
import { GuestRoute, ProtectedRoute } from './auth/Routes';
import { useAuth } from './auth/AuthContext';
import { homeForRole } from './auth/roleHome';
import { FullScreenLoader } from './components/FullScreenLoader';
import { ClientDashboardPage } from './pages/ClientDashboardPage';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { OpsDashboardPage } from './pages/OpsDashboardPage';
import { RegisterPage } from './pages/RegisterPage';

// Leaflet pesa ~150 KB minificado: la vista de seguimiento se carga bajo demanda.
const TrackingPage = lazy(() =>
  import('./pages/TrackingPage').then((module) => ({ default: module.TrackingPage })),
);

// Las páginas del portal del cliente se cargan bajo demanda (el detalle incluye qrcode).
const WizardPage = lazy(() =>
  import('./pages/WizardPage').then((module) => ({ default: module.WizardPage })),
);
const ShipmentsPage = lazy(() =>
  import('./pages/ShipmentsPage').then((module) => ({ default: module.ShipmentsPage })),
);
const ShipmentDetailPage = lazy(() =>
  import('./pages/ShipmentDetailPage').then((module) => ({ default: module.ShipmentDetailPage })),
);

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
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/seguimiento/:codigo"
        element={
          <Suspense fallback={<FullScreenLoader />}>
            <TrackingPage />
          </Suspense>
        }
      />
      {/* Alias para el CTA «Cotizar envío» hasta que exista el cotizador (PR #5/#6). */}
      <Route path="/registro" element={<Navigate to="/register" replace />} />

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
        path="/app/nuevo"
        element={
          <ProtectedRoute allowedRoles={[RolUsuario.CLIENTE]}>
            <Suspense fallback={<FullScreenLoader />}>
              <WizardPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/envios"
        element={
          <ProtectedRoute allowedRoles={[RolUsuario.CLIENTE]}>
            <Suspense fallback={<FullScreenLoader />}>
              <ShipmentsPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/envios/:codigo"
        element={
          <ProtectedRoute allowedRoles={[RolUsuario.CLIENTE]}>
            <Suspense fallback={<FullScreenLoader />}>
              <ShipmentDetailPage />
            </Suspense>
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
