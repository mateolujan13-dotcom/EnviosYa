import { Truck } from 'lucide-react';

export function FullScreenLoader() {
  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-ink-950 flex items-center justify-center animate-pulse">
        <Truck className="w-6 h-6 text-signal-500" />
      </div>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-500">
        Cargando sesión
      </p>
    </div>
  );
}
