import { Link } from 'react-router-dom';
import { Truck } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Servicios', href: '#servicios' },
  { label: 'Cómo Funciona', href: '#como-funciona' },
  { label: 'Cobertura', href: '#cobertura' },
  { label: 'Tarifas', href: '#tarifas' },
  { label: 'Empresas', href: '#empresas' },
] as const;

/**
 * Barra superior pública (landing y seguimiento).
 * Links apuntan a anchors de la landing; en otras páginas cambian
 * el hash sin navegar fuera del documento.
 */
export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-sand-200 bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link
            to="/"
            aria-label="EnvíoYa, ir al inicio"
            className="inline-flex items-center gap-2.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
          >
            <span
              aria-hidden="true"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-signal-600 text-white"
            >
              <Truck className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
            </span>
            <span className="font-display text-xl font-bold tracking-tight text-ink-950">
              Envío<span className="text-signal-600">Ya</span>
            </span>
          </Link>

          <nav aria-label="Navegación principal" className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded text-sm font-medium text-ink-700 transition-colors hover:text-ink-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/login"
            className="rounded px-3 py-2 text-sm font-semibold text-ink-700 transition-colors hover:text-ink-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
          >
            Ingresar
          </Link>
          <Link
            to="/registro"
            className="inline-flex items-center justify-center rounded-lg bg-signal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-signal-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-signal-500/30 sm:px-5"
          >
            Cotizar envío
          </Link>
        </div>
      </div>
    </header>
  );
}
