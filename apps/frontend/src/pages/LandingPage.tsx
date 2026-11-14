import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  MapPin,
  Package,
  PackageCheck,
  PackageOpen,
  Radar,
  ShieldCheck,
  Store,
  Calculator,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { PublicHeader } from '../components/public/PublicHeader';
import { PublicFooter } from '../components/public/PublicFooter';

const TRACKING_CODE_PATTERN = /^EY-[A-Z0-9]{6}$/i;

interface ServiceCard {
  id?: string;
  icon: LucideIcon;
  title: string;
  chip: string;
  chipId?: string;
  chipClass: string;
  description: string;
  linkLabel: string;
  linkTo: string;
}

const SERVICE_CARDS: ServiceCard[] = [
  {
    icon: Package,
    title: 'Particulares',
    chip: 'Desde $4.200 ARS',
    chipId: 'tarifas',
    chipClass: 'bg-paper border border-sand-300 text-ink-900',
    description:
      'Envíos puerta a puerta, encomiendas personales y compras online. Retiro a domicilio sin costo adicional en radios urbanos.',
    linkLabel: 'Cotizar particular',
    linkTo: '/registro',
  },
  {
    id: 'empresas',
    icon: Building2,
    title: 'Empresas',
    chip: 'B2B & eCommerce',
    chipClass: 'bg-route-100 text-route-600',
    description:
      'Soluciones B2B integradas con tu tienda online, logística inversa masiva y facturación centralizada para tu operación.',
    linkLabel: 'Ver planes corporativos',
    linkTo: '/registro',
  },
  {
    icon: Radar,
    title: 'Seguimiento',
    chip: 'Tracking en vivo',
    chipClass: 'bg-mint-100 text-ink-950',
    description:
      'Cada paquete, cada hito: historial de eventos de escaneo y comprobante digital al momento de la entrega. Sin registro previo.',
    linkLabel: 'Probar tracking demo',
    linkTo: '/seguimiento/EY-4F8A1C',
  },
];

const STEPS = [
  {
    number: '01',
    icon: Calculator,
    title: 'Cotizá y generá tu etiqueta',
    description:
      'Ingresá origen, destino y medidas. Obtené el valor al instante en pesos argentinos e imprimí la etiqueta con código unificado EY.',
  },
  {
    number: '02',
    icon: Store,
    title: 'Despachá o pedí retiro',
    description:
      'Dejalo en cualquiera de nuestras sucursales o pedí el retiro por tu puerta, sin vueltas ni demoras en ventanilla.',
  },
  {
    number: '03',
    icon: PackageCheck,
    title: 'Seguimiento hasta la entrega',
    description:
      'Seguí cada hito del envío desde el código de seguimiento, gratis y sin crear una cuenta.',
  },
] as const;

export function LandingPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleTrackSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalized = code.trim().toUpperCase();

    if (!TRACKING_CODE_PATTERN.test(normalized)) {
      setError('Ingresá un código válido con formato EY-XXXXXX (6 caracteres alfanuméricos).');
      return;
    }

    setError(null);
    navigate(`/seguimiento/${normalized}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper font-body text-ink-950">
      <PublicHeader />

      <main className="flex-grow">
        {/* Hero */}
        <section
          aria-labelledby="hero-heading"
          className="mx-auto w-full max-w-[1200px] px-4 py-12 sm:px-6 lg:py-16"
        >
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            <div className="flex flex-col justify-center lg:col-span-7">
              <div className="mb-4 inline-flex items-center gap-2">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-signal-600" />
                <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-500">
                  LOGÍSTICA NACIONAL
                </span>
              </div>

              <h1
                id="hero-heading"
                className="mb-4 font-display text-4xl font-bold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl xl:text-6xl"
              >
                Tu envío, en el mapa.
                <br />
                Sin sorpresas.
              </h1>

              <p className="mb-8 max-w-xl text-lg leading-relaxed text-ink-700">
                Cotizá, despachá y seguí cada paquete desde un solo lugar.
                Cobertura federal con trazabilidad transparente de extremo a extremo.
              </p>

              {/* Quick tracking box */}
              <div className="mb-6 max-w-xl rounded-xl border border-sand-300 bg-white p-5 shadow-sm">
                <label
                  htmlFor="landing-tracking-input"
                  className="mb-2 block font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-500"
                >
                  SEGUIMIENTO EN TIEMPO REAL
                </label>
                <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleTrackSubmit} noValidate>
                  <div className="relative flex-grow">
                    <MapPin
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-500"
                    />
                    <input
                      id="landing-tracking-input"
                      name="codigo"
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Ingresá tu código EY-XXXXXX"
                      value={code}
                      onChange={(event) => {
                        setCode(event.target.value);
                        setError(null);
                      }}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? 'landing-tracking-error' : undefined}
                      className="h-12 w-full rounded-lg border border-sand-300 bg-white py-3 pl-10 pr-3 font-mono text-sm uppercase tracking-wider text-ink-900 placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-500 focus:border-route-600 focus:outline-none focus:ring-2 focus:ring-route-600"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-lg bg-ink-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-ink-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
                  >
                    Seguir envío
                  </button>
                </form>
                <p
                  id="landing-tracking-error"
                  aria-live="polite"
                  className={clsx('mt-2 text-sm font-medium text-danger-600', !error && 'sr-only')}
                >
                  {error}
                </p>
              </div>

              {/* Primary CTA + trust row */}
              <div className="flex max-w-xl flex-col gap-4 sm:flex-row sm:items-center">
                <Link
                  to="/registro"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-signal-600 px-8 text-base font-semibold text-white shadow-sm transition-all hover:bg-signal-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-signal-500/30 active:scale-[0.98]"
                >
                  Cotizar envío
                  <ArrowRight aria-hidden="true" className="h-5 w-5" />
                </Link>
                <p className="flex items-center gap-2 text-sm text-ink-500">
                  <ShieldCheck aria-hidden="true" className="h-[18px] w-[18px] text-signal-600" />
                  Sin cuenta previa para seguir un envío
                </p>
              </div>

              <p className="mt-4 text-sm text-ink-500">
                ¿Querés ver un ejemplo?{' '}
                <Link
                  to="/seguimiento/EY-4F8A1C"
                  className="rounded font-semibold text-route-600 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
                >
                  Probar tracking demo
                </Link>
              </p>
            </div>

            {/* Decorative route card (sin datos reales) */}
            <div className="lg:col-span-5" aria-hidden="true">
              <div className="relative flex h-[380px] flex-col justify-between overflow-hidden rounded-xl border border-sand-300 bg-white p-6 sm:h-[440px]">
                <div
                  className="pointer-events-none absolute inset-0 opacity-40"
                  style={{
                    backgroundImage:
                      'linear-gradient(to right, #D8D0C0 1px, transparent 1px), linear-gradient(to bottom, #D8D0C0 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                  }}
                />
                <div className="relative z-10 flex items-center justify-between border-b border-sand-200 pb-3">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                    Corredor central
                  </span>
                  <span className="rounded-lg border border-sand-300 bg-paper px-2 py-0.5 font-mono text-[11px] font-medium text-ink-700">
                    RN 9
                  </span>
                </div>

                <svg
                  viewBox="0 0 340 200"
                  className="relative z-0 my-auto h-44 w-full sm:h-56"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M 20 180 Q 90 140 120 70 T 320 20"
                    stroke="#E7DFD1"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M 50 190 Q 140 160 180 120 T 330 90"
                    stroke="#E7DFD1"
                    strokeDasharray="4 4"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M 60 140 Q 140 100 205 92"
                    stroke="#D93A00"
                    strokeLinecap="round"
                    strokeWidth="3.5"
                  />
                  <path
                    d="M 205 92 Q 250 84 285 58"
                    stroke="#D93A00"
                    strokeDasharray="6 6"
                    strokeLinecap="round"
                    strokeWidth="3"
                  />
                  <g transform="translate(60, 140)">
                    <circle r="10" fill="#0B1220" />
                    <circle r="4" fill="#F6F2E9" />
                    <text x="-12" y="26" fill="#0B1220" fontSize="12" fontWeight="600">
                      Córdoba
                    </text>
                  </g>
                  <g transform="translate(205, 92)">
                    <circle r="12" fill="#DBEAFE" fillOpacity="0.85" />
                    <circle r="6" fill="#1D4ED8" />
                    <circle r="2.5" fill="#FFFFFF" />
                  </g>
                  <g transform="translate(285, 58)">
                    <circle r="12" fill="#D93A00" fillOpacity="0.18" />
                    <circle r="9" fill="#D93A00" />
                    <circle r="3.5" fill="#FFFFFF" />
                    <text x="-8" y="26" fill="#0B1220" fontSize="12" fontWeight="600">
                      Rosario
                    </text>
                  </g>
                </svg>

                <div className="relative z-10 rounded-xl border border-sand-300 bg-white p-4">
                  <div className="flex items-center gap-2">
                    <PackageOpen aria-hidden="true" className="h-4 w-4 text-signal-600" />
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                      Origen → Destino
                    </p>
                  </div>
                  <p className="mt-1 font-display text-lg font-bold text-ink-950">
                    Córdoba → Rosario
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust strip */}
        <section
          aria-label="EnvíoYa en números"
          className="w-full border-y border-sand-300 bg-white py-8"
        >
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
            <div className="grid grid-cols-1 divide-y divide-sand-300 md:grid-cols-3 md:divide-x md:divide-y-0">
              <div className="flex flex-col justify-center py-4 md:py-0 md:pl-0 md:pr-8">
                <span className="font-display text-4xl font-bold tracking-tight text-ink-900">
                  +12.000
                </span>
                <span className="mt-1 text-sm text-ink-700">
                  Envíos completados este mes en todo el país
                </span>
              </div>
              <div className="flex flex-col justify-center py-4 md:py-0 md:px-8">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-4xl font-bold tracking-tight text-ink-900">
                    98%
                  </span>
                  <span className="rounded bg-mint-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-ink-950">
                    SLA OK
                  </span>
                </div>
                <span className="mt-1 text-sm text-ink-700">
                  Entregas a tiempo certificadas por auditoría
                </span>
              </div>
              <div id="cobertura" className="flex scroll-mt-24 flex-col justify-center py-4 md:py-0 md:pl-8 md:pr-0">
                <span className="font-display text-2xl font-bold tracking-tight text-ink-900">
                  Cobertura nacional
                </span>
                <span className="mt-1 text-sm text-ink-700">
                  24 provincias y más de 800 localidades conectadas
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Servicios */}
        <section
          aria-labelledby="servicios-heading"
          id="servicios"
          className="mx-auto w-full max-w-[1200px] scroll-mt-24 px-4 py-16 sm:px-6"
        >
          <div className="mb-10">
            <span className="mb-2 block font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-500">
              SERVICIOS
            </span>
            <h2
              id="servicios-heading"
              className="font-display text-3xl font-bold tracking-tight text-ink-950"
            >
              Logística diseñada para cada escala
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {SERVICE_CARDS.map((card) => (
              <article
                key={card.title}
                id={card.id}
                className="flex scroll-mt-24 flex-col justify-between rounded-xl border border-sand-300 bg-white p-6"
              >
                <div>
                  <div
                    aria-hidden="true"
                    className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-sand-300 bg-paper text-ink-900"
                  >
                    <card.icon className="h-6 w-6" strokeWidth={1.8} />
                  </div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-2xl font-semibold text-ink-950">
                      {card.title}
                    </h3>
                    <span
                      id={card.chipId}
                      className={clsx(
                        'scroll-mt-24 rounded px-2 py-1 font-mono text-[11px] font-medium',
                        card.chipClass,
                      )}
                    >
                      {card.chip}
                    </span>
                  </div>
                  <p className="mb-6 text-base leading-relaxed text-ink-700">
                    {card.description}
                  </p>
                </div>
                <div className="border-t border-sand-200 pt-4">
                  <Link
                    to={card.linkTo}
                    className="inline-flex items-center rounded text-base font-semibold text-ink-900 transition-colors hover:text-signal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
                  >
                    {card.linkLabel}
                    <ArrowRight aria-hidden="true" className="ml-1.5 h-[18px] w-[18px]" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Cómo funciona */}
        <section
          aria-labelledby="como-funciona-heading"
          id="como-funciona"
          className="w-full scroll-mt-24 border-y border-sand-300 bg-white py-16"
        >
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
            <div className="mb-12">
              <span className="mb-2 block font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-500">
                PROCESO OPERATIVO
              </span>
              <h2
                id="como-funciona-heading"
                className="font-display text-3xl font-bold tracking-tight text-ink-950"
              >
                Tu paquete en destino en 3 pasos
              </h2>
            </div>
            <ol className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
              {STEPS.map((step) => (
                <li
                  key={step.number}
                  className="relative rounded-xl border border-sand-300 bg-paper p-6"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span
                      aria-hidden="true"
                      className="font-mono text-3xl font-bold text-ink-900"
                    >
                      {step.number}
                    </span>
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-sand-300 bg-white text-ink-700"
                    >
                      <step.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    </span>
                  </div>
                  <h3 className="mb-2 font-display text-xl font-semibold text-ink-950">
                    {step.title}
                  </h3>
                  <p className="text-base leading-relaxed text-ink-700">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CTA band */}
        <section aria-labelledby="cta-band-heading" className="mx-auto w-full max-w-[1200px] px-4 py-16 sm:px-6">
          <div className="relative overflow-hidden rounded-xl border border-ink-700 bg-ink-950 p-8 text-white sm:p-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 right-0 top-0 hidden w-1/3 opacity-10 md:block"
              style={{
                backgroundImage: 'radial-gradient(#FFFFFF 1px, transparent 1px)',
                backgroundSize: '16px 16px',
              }}
            />
            <div className="relative z-10 max-w-2xl">
              <span className="mb-2 block font-mono text-[11px] font-semibold uppercase tracking-widest text-sand-300">
                OPERATORIA INMEDIATA
              </span>
              <h2
                id="cta-band-heading"
                className="mb-4 font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl"
              >
                Cotizá tu próximo envío en menos de 2 minutos
              </h2>
              <p className="mb-8 text-lg leading-relaxed text-sand-300">
                Sin contratos forzosos ni comisiones ocultas. Pagás solo por lo
                que enviás, con tarifas competitivas para todo el país.
              </p>
              <Link
                to="/registro"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-signal-600 px-8 py-3.5 text-base font-semibold text-white transition-all hover:bg-signal-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-signal-500/30 active:scale-[0.98]"
              >
                Cotizar envío
                <ArrowRight aria-hidden="true" className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
