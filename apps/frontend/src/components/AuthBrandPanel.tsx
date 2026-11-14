import {
  MapPin,
  Route,
  Satellite,
  ShieldCheck,
  Truck,
} from 'lucide-react';

interface AuthBrandPanelProps {
  mode: 'login' | 'register';
}

const COPY = {
  login: {
    eyebrow: 'Plataforma operativa B2B & B2C',
    title: 'Todos tus envíos,\nen un solo lugar.',
    description:
      'Trazabilidad satelital en tiempo real, gestión de despachos corporativos y control operativo de punta a punta.',
  },
  register: {
    eyebrow: 'Alta de cuenta digital',
    title: 'Empezá a despachar\nen minutos.',
    description:
      'Cotizá, creá y seguí tus envíos con trazabilidad garantizada en todo el territorio nacional.',
  },
} satisfies Record<
  AuthBrandPanelProps['mode'],
  { eyebrow: string; title: string; description: string }
>;

export function AuthBrandPanel({ mode }: AuthBrandPanelProps) {
  const copy = COPY[mode];

  return (
    <section className="hidden lg:flex w-[54%] min-h-screen bg-ink-950 relative overflow-hidden flex-col justify-between p-10 xl:p-14 text-white select-none">
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
        viewBox="0 0 1200 900"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="auth-route-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1D4ED8" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#FF5A1F" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#2151DA" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        <path
          d="M-50,180 C200,120 400,280 650,220 C850,170 1000,320 1200,260"
          fill="none"
          stroke="rgba(29, 78, 216, 0.25)"
          strokeDasharray="6 6"
          strokeWidth="2"
        />
        <path
          d="M-20,480 C240,420 380,560 620,440 C880,310 1050,490 1250,380"
          fill="none"
          stroke="url(#auth-route-gradient)"
          strokeWidth="2.5"
        />
        <path
          d="M120,800 C320,620 540,780 780,610 C960,480 1100,540 1280,480"
          fill="none"
          stroke="rgba(255, 90, 31, 0.3)"
          strokeDasharray="4 8"
          strokeWidth="1.5"
        />
        <circle cx="240" cy="420" r="4" fill="#1D4ED8" />
        <circle cx="240" cy="420" r="10" fill="none" opacity="0.6" stroke="#1D4ED8" />
        <circle cx="620" cy="440" r="5" fill="#FF5A1F" />
        <circle cx="620" cy="440" r="14" fill="none" opacity="0.5" stroke="#FF5A1F" />
        <circle cx="880" cy="310" r="4" fill="#B9F27C" />
        <circle cx="880" cy="310" r="8" fill="none" opacity="0.6" stroke="#B9F27C" />
      </svg>

      <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-ink-950/80 pointer-events-none" />

      <header className="relative z-10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-[11px] text-sand-300 tracking-wider">
          <span className="w-2 h-2 rounded-full bg-mint-300 animate-pulse" />
          NODO_CENTRAL_AR // REGION_CENTRO
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-ink-900/90 border border-white/10 rounded-full text-[11px] text-sand-200">
          <Satellite className="w-3.5 h-3.5 text-signal-500" />
          Telemetría satelital activa
        </div>
      </header>

      <div className="relative z-10 my-auto py-10">
        <div className="max-w-xl mb-10">
          <div className="inline-block mb-4 px-3 py-1 rounded bg-signal-600/15 border border-signal-600/40 text-signal-500 font-mono text-[11px] font-semibold tracking-wider uppercase">
            {copy.eyebrow}
          </div>
          <h2 className="font-display font-bold tracking-tight text-white text-4xl xl:text-[52px] leading-[1.05] mb-4 whitespace-pre-line">
            {copy.title}
          </h2>
          <p className="text-base text-sand-200 max-w-lg leading-relaxed">
            {copy.description}
          </p>
        </div>

        <div className="max-w-md w-full bg-ink-900/90 backdrop-blur rounded-xl p-6 border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-route-600 via-signal-500 to-mint-300" />

          <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <span className="block text-[10px] text-sand-300 uppercase tracking-wider font-medium">
                Guía operativa
              </span>
              <span className="font-mono text-lg font-semibold text-white tracking-wider">
                EY-4F8A1C
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-route-100 text-route-600 text-[11px] font-bold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-route-600 animate-ping" />
              En tránsito
            </span>
          </div>

          <div className="py-5">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div>
                <span className="block text-[10px] text-sand-300">Origen</span>
                <span className="block text-sm font-bold text-white">Córdoba</span>
                <span className="block font-mono text-[10px] text-sand-300">Hub COR-01</span>
              </div>

              <div className="flex-1 flex flex-col items-center">
                <div className="w-full flex items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-route-600 ring-4 ring-route-600/20 shrink-0" />
                  <div className="flex-1 h-0.5 bg-gradient-to-r from-route-600 via-signal-500 to-white/20 relative mx-1">
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-ink-950 p-1 rounded-full border border-signal-500 text-signal-500">
                      <Truck className="w-3 h-3" />
                    </div>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-white/20 shrink-0" />
                </div>
                <span className="font-mono text-[10px] text-sand-300 mt-2">
                  402 km completados (68%)
                </span>
              </div>

              <div className="text-right">
                <span className="block text-[10px] text-sand-300">Destino</span>
                <span className="block text-sm font-bold text-white">Rosario</span>
                <span className="block font-mono text-[10px] text-sand-300">Centro ROS-03</span>
              </div>
            </div>

            <div className="mt-4 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-route-600 to-signal-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10 text-[11px]">
            <div className="flex items-center gap-2 text-sand-200">
              <MapPin className="w-3.5 h-3.5 text-mint-300" />
              Último escaneo: Rosario
            </div>
            <div className="flex items-center justify-end gap-2 text-sand-200">
              <Route className="w-3.5 h-3.5 text-signal-500" />
              ETA hoy 18:40
            </div>
          </div>
        </div>
      </div>

      <footer className="relative z-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-5">
        <Feature icon={ShieldCheck} title="Sesión segura" detail="Cookie httpOnly" />
        <Feature icon={Route} title="Trazabilidad" detail="Eventos en tiempo real" />
        <Feature icon={Truck} title="Cobertura" detail="Operación nacional" />
      </footer>
    </section>
  );
}

function Feature({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof ShieldCheck;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 text-signal-500 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs font-semibold text-white">{title}</p>
        <p className="text-[10px] text-sand-300">{detail}</p>
      </div>
    </div>
  );
}
