import { Link } from 'react-router-dom';
import { Truck } from 'lucide-react';
import clsx from 'clsx';

interface LogoProps {
  dark?: boolean;
}

export function Logo({ dark = false }: LogoProps) {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-2.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
      aria-label="EnvíoYa, ir al inicio"
    >
      <span className="relative w-9 h-9 rounded-lg bg-ink-950 flex items-center justify-center shadow-sm">
        <Truck className="w-[18px] h-[18px] text-signal-500" strokeWidth={2.2} />
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-signal-600 border-2 border-paper" />
      </span>
      <span
        className={clsx(
          'font-display font-bold text-xl tracking-tight',
          dark ? 'text-white' : 'text-ink-950',
        )}
      >
        Envío<span className="text-signal-600">Ya</span>
      </span>
    </Link>
  );
}
