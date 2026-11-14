import { Truck } from 'lucide-react';

const COLUMNS = [
  {
    title: 'Producto',
    links: [
      { label: 'Servicios', href: '#servicios' },
      { label: 'Tarifas', href: '#tarifas' },
      { label: 'Cobertura', href: '#cobertura' },
      { label: 'API Desarrolladores', href: '#' },
    ],
  },
  {
    title: 'Compañía',
    links: [
      { label: 'Sobre EnvíoYa', href: '#' },
      { label: 'Sucursales', href: '#' },
      { label: 'Novedades', href: '#' },
      { label: 'Contacto Operacional', href: '#' },
    ],
  },
  {
    title: 'Soporte',
    links: [
      { label: 'Centro de Ayuda', href: '#' },
      { label: 'Seguridad de Envíos', href: '#' },
      { label: 'Términos y Condiciones', href: '#' },
      { label: 'Política de Privacidad', href: '#' },
    ],
  },
] as const;

/**
 * Pie de página público. Los links que no tienen página pública aún
 * son anchors de la landing o `#` inertes; no apuntan a páginas
 * inexistentes.
 */
export function PublicFooter() {
  return (
    <footer className="w-full border-t border-ink-700 bg-ink-950 text-sand-300">
      <div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-10 border-b border-ink-700 pb-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <div className="mb-4 flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-signal-600 text-white"
              >
                <Truck className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
              </span>
              <span className="font-display text-xl font-bold tracking-tight text-white">
                Envío<span className="text-signal-600">Ya</span>
              </span>
            </div>
            <p className="mb-6 max-w-sm text-sm leading-relaxed text-sand-300">
              Infraestructura logística inteligente para personas y empresas.
              Trazabilidad de extremo a extremo en todo el territorio argentino.
            </p>
            <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-sand-300">
              SOPORTE OPERATIVO: 0810-333-ENVIOS
            </p>
          </div>

          <nav
            aria-label="Enlaces del pie de página"
            className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-8 md:col-start-5"
          >
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <h2 className="mb-4 font-display text-sm font-semibold text-white">
                  {column.title}
                </h2>
                <ul className="space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="rounded text-sm text-sand-300 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 pt-8 text-xs text-sand-300 sm:flex-row">
          <p>© 2026 EnvíoYa Logística Integral S.A. Todos los derechos reservados.</p>
          <div className="flex items-center gap-3">
            <span>Buenos Aires, Argentina</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-wider text-mint-300">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-mint-300"
              />
              SISTEMA OPERATIVO
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
