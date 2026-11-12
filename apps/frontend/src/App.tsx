import React from 'react';
import { EstadoEnvio } from '@envioya/shared';
import { Package, ShieldCheck, ArrowRight } from 'lucide-react';

export const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col justify-between p-8 max-w-5xl mx-auto">
      <header className="flex items-center justify-between pb-6 border-b border-sand-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-signal-600 flex items-center justify-center text-white font-display font-bold text-xl">
            E
          </div>
          <span className="font-display font-bold text-2xl tracking-tight text-ink-950">
            EnvíoYa
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-ink-500 font-mono">
          <ShieldCheck className="w-4 h-4 text-signal-600" />
          <span>Monorepo Inicializado</span>
        </div>
      </header>

      <main className="my-auto py-12 flex flex-col items-center text-center">
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-sand-200 text-ink-700 uppercase tracking-wider mb-4">
          Sprint 1 — PR #1 Foundation
        </span>
        <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-ink-950 max-w-2xl mb-6">
          Torre de Control & Portal de Logística
        </h1>
        <p className="text-lg text-ink-700 max-w-xl mb-8 font-body">
          Contratos tipados con <code className="bg-sand-200 px-2 py-0.5 rounded font-mono text-sm">@envioya/shared</code> y arquitectura desacoplada NestJS + React.
        </p>

        <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-sand-300 shadow-sm max-w-md w-full justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-signal-600" />
            <div className="text-left">
              <p className="text-xs text-ink-500 uppercase font-mono">Estado Inicial</p>
              <p className="font-semibold text-ink-950 capitalize">{EstadoEnvio.PENDIENTE}</p>
            </div>
          </div>
          <button className="flex items-center gap-1.5 bg-signal-600 hover:bg-signal-500 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm">
            <span>Comenzar</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>

      <footer className="text-center text-sm text-ink-500 pt-6 border-t border-sand-300 font-mono">
        EnvíoYa App · Control Tower Wayfinding Design System
      </footer>
    </div>
  );
};
