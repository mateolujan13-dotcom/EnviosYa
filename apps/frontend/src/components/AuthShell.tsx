import { ReactNode } from 'react';
import { Logo } from './Logo';
import { AuthBrandPanel } from './AuthBrandPanel';

interface AuthShellProps {
  mode: 'login' | 'register';
  children: ReactNode;
}

export function AuthShell({ mode, children }: AuthShellProps) {
  return (
    <main className="min-h-screen w-full flex flex-col lg:flex-row bg-paper">
      <section className="w-full lg:w-[46%] min-h-screen px-6 sm:px-10 xl:px-16 py-8 lg:py-10 flex flex-col justify-between border-r border-sand-200">
        <header className="flex items-center justify-between gap-4">
          <Logo />
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-sand-200 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[10px] font-medium text-ink-700 tracking-tight">
              Sistemas operativos 100%
            </span>
          </div>
        </header>

        <div className="w-full max-w-md mx-auto my-auto py-8">{children}</div>

        <footer className="pt-6 border-t border-sand-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-ink-500">
          <p className="font-medium text-ink-700">
            EnvíoYa Logística Integral · Soporte 0810-333-ENVIOS
          </p>
          <div className="flex items-center gap-3">
            <span>Centro de Ayuda</span>
            <span className="text-sand-300">·</span>
            <span>Seguridad</span>
          </div>
        </footer>
      </section>

      <AuthBrandPanel mode={mode} />
    </main>
  );
}
