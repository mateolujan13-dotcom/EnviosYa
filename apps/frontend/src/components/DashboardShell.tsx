import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { roleLabel } from '../auth/roleHome';
import { Logo } from './Logo';

interface DashboardShellProps {
  badge: string;
  children: ReactNode;
}

export function DashboardShell({ badge, children }: DashboardShellProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  if (!user) {
    return null;
  }

  const initials = user.nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const handleLogout = async () => {
    setLoggingOut(true);

    try {
      await logout();
    } catch {
      // La sesión local se limpia igual; el usuario vuelve al login.
    } finally {
      setLoggingOut(false);
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="bg-white border-b border-sand-200">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Logo />
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sand-200/70 border border-sand-300 text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-700">
              <ShieldCheck className="w-3 h-3 text-signal-600" />
              {badge}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-ink-950 leading-tight">
                {user.nombre}
              </p>
              <p className="text-[11px] text-ink-500">{roleLabel(user.rol)}</p>
            </div>
            <div
              className="w-9 h-9 rounded-full bg-ink-950 text-white flex items-center justify-center text-xs font-bold"
              aria-hidden="true"
            >
              {initials}
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-sand-300 bg-white text-xs font-semibold text-ink-700 hover:border-ink-500 hover:text-ink-950 transition-colors disabled:opacity-60"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {loggingOut ? 'Saliendo…' : 'Salir'}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-5 sm:px-8 py-8">
        {children}
      </main>

      <footer className="border-t border-sand-200 bg-paper">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-ink-500">
          <span>EnvíoYa · Control Tower Wayfinding Design System</span>
          <span className="font-mono">PR #3 · Autenticación y RBAC</span>
        </div>
      </footer>
    </div>
  );
}
