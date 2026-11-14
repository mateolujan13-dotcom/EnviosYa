import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowLeft,
  Check,
  Copy,
  Headset,
  LockOpen,
  Map as MapIcon,
  Phone,
  Search,
} from 'lucide-react';
import clsx from 'clsx';
import type { PublicTrackingDto } from '@envioya/shared';
import { api, ApiError } from '../lib/api';
import { lookupBranchCoords } from '../lib/branchCoords';
import { PublicHeader } from '../components/public/PublicHeader';
import { PublicFooter } from '../components/public/PublicFooter';

const ART_TIMEZONE = 'America/Argentina/Buenos_Aires';
const TRACKING_CODE_PATTERN = /^EY-[A-Z0-9]{6}$/i;

const EVENT_TYPE_LABELS: Record<string, string> = {
  escaneo_sucursal: 'Escaneo en sucursal',
  cambio_estado: 'Cambio de estado',
  lectura_gps: 'Lectura GPS',
  asignacion_reparto: 'Asignación a reparto',
  entrega: 'Entrega',
  incidencia: 'Incidencia',
};

const ESTADO_META: Record<string, { label: string; chipClass: string; headline: string }> = {
  pendiente: {
    label: 'Pendiente',
    chipClass: 'bg-route-100 text-route-600',
    headline: 'Tu envío fue registrado.',
  },
  en_transito: {
    label: 'En tránsito',
    chipClass: 'bg-route-100 text-route-600',
    headline: 'Tu envío está en camino.',
  },
  en_sucursal: {
    label: 'En sucursal',
    chipClass: 'bg-route-100 text-route-600',
    headline: 'Tu envío está en camino.',
  },
  en_reparto: {
    label: 'En reparto',
    chipClass: 'bg-route-100 text-route-600',
    headline: 'Tu envío está en camino.',
  },
  entregado: {
    label: 'Entregado',
    chipClass: 'bg-mint-100 text-ink-950 border border-mint-300',
    headline: 'Envío entregado.',
  },
  con_incidencia: {
    label: 'Con incidencia',
    chipClass: 'bg-danger-100 text-danger-600',
    headline: 'Tu envío tiene una incidencia.',
  },
  devuelto: {
    label: 'Devuelto',
    chipClass: 'bg-danger-100 text-danger-600',
    headline: 'Tu envío fue devuelto.',
  },
  cancelado: {
    label: 'Cancelado',
    chipClass: 'bg-danger-100 text-danger-600',
    headline: 'Tu envío fue cancelado.',
  },
};

const FALLBACK_ESTADO_META = ESTADO_META.en_transito;

function estadoMeta(estado: string) {
  return ESTADO_META[estado] ?? FALLBACK_ESTADO_META;
}

function eventTitle(tipo: string): string {
  const mapped = EVENT_TYPE_LABELS[tipo];
  if (mapped) return mapped;
  const humanized = tipo.replace(/[_-]+/g, ' ').trim();
  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}

/** «10/11 · 18:00» en zona America/Argentina/Buenos_Aires. */
function formatEventTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const parts = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: ART_TIMEZONE,
  }).formatToParts(date);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('day')}/${get('month')} · ${get('hour')}:${get('minute')}`;
}

/** «10/11/2026»; si la fecha viene como «YYYY-MM-DD» se respeta literal. */
function formatDateAr(iso: string | null | undefined): string {
  if (!iso) return '—';

  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [year, month, day] = iso.split('-');
    return `${day}/${month}/${year}`;
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: ART_TIMEZONE,
  }).format(date);
}

function formatPeso(pesoKg: number): string {
  return pesoKg.toLocaleString('es-AR', { maximumFractionDigits: 2 });
}

type FetchStatus = 'loading' | 'error' | 'success';

export function TrackingPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const navigate = useNavigate();

  const [status, setStatus] = useState<FetchStatus>('loading');
  const [dto, setDto] = useState<PublicTrackingDto | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [retryCode, setRetryCode] = useState('');
  const [retryError, setRetryError] = useState<string | null>(null);

  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copyTimeoutRef = useRef<number | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setStatus('loading');
    setDto(null);
    setServerMessage(null);
    setCopyState('idle');

    api<PublicTrackingDto>(
      `/shipments/track/${encodeURIComponent(codigo ?? '')}`,
      { signal: controller.signal },
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        setDto(data);
        setStatus('success');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError) {
          setServerMessage(error.message);
        } else if (error instanceof Error && error.name === 'AbortError') {
          return;
        } else {
          setServerMessage('No pudimos cargar el envío. Verificá tu conexión e intentá nuevamente.');
        }
        setStatus('error');
      });

    return () => controller.abort();
  }, [codigo, reloadKey]);

  const originCiudad = dto?.origen.ciudad ?? null;
  const destinoCiudad = dto?.destino.ciudad ?? null;
  const originCoords = originCiudad ? lookupBranchCoords(originCiudad) : null;
  const destinoCoords = destinoCiudad ? lookupBranchCoords(destinoCiudad) : null;
  const mapSupported = originCoords !== null && destinoCoords !== null;

  useEffect(() => {
    if (status !== 'success' || !dto || !mapContainerRef.current) return undefined;
    if (!originCoords || !destinoCoords) return undefined;

    const map = L.map(mapContainerRef.current, { scrollWheelZoom: false });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const tooltipContent = (text: string) => {
      const el = document.createElement('span');
      el.textContent = text;
      return el;
    };

    const originIcon = L.divIcon({
      className: '',
      html: '<div style="width:22px;height:22px;border-radius:9999px;background:#08111F;border:3px solid #F6F2E9;box-shadow:0 1px 4px rgba(8,17,31,0.45)"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    const destinationIcon = L.divIcon({
      className: '',
      html: '<div style="width:22px;height:22px;border-radius:9999px;background:#D93A00;border:3px solid #F6F2E9;box-shadow:0 1px 4px rgba(8,17,31,0.45)"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    L.marker([originCoords.lat, originCoords.lng], { icon: originIcon, alt: `Origen: ${dto.origen.ciudad}` })
      .bindTooltip(tooltipContent(`Origen: ${dto.origen.ciudad}`), {
        permanent: true,
        direction: 'top',
        offset: [0, -10],
      })
      .addTo(map);

    L.marker([destinoCoords.lat, destinoCoords.lng], {
      icon: destinationIcon,
      alt: `Destino: ${dto.destino.ciudad}`,
    })
      .bindTooltip(tooltipContent(`Destino: ${dto.destino.ciudad}`), {
        permanent: true,
        direction: 'top',
        offset: [0, -10],
      })
      .addTo(map);

    L.polyline(
      [
        [originCoords.lat, originCoords.lng],
        [destinoCoords.lat, destinoCoords.lng],
      ],
      { color: '#D93A00', weight: 3, dashArray: '5,9' },
    ).addTo(map);

    map.fitBounds(
      L.latLngBounds([
        [originCoords.lat, originCoords.lng],
        [destinoCoords.lat, destinoCoords.lng],
      ]),
      { padding: [40, 40] },
    );

    return () => {
      map.remove();
    };
    // dto cambia solo en cada fetch; mapa se recrea y se destruye limpiamente.
  }, [status, dto]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleRetrySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalized = retryCode.trim().toUpperCase();

    if (!TRACKING_CODE_PATTERN.test(normalized)) {
      setRetryError('Ingresá un código válido con formato EY-XXXXXX (6 caracteres alfanuméricos).');
      return;
    }

    setRetryError(null);

    if (normalized === (codigo ?? '').toUpperCase()) {
      setReloadKey((current) => current + 1);
      return;
    }

    navigate(`/seguimiento/${normalized}`);
  };

  const handleCopyLink = async () => {
    const url = window.location.href;

    try {
      await navigator.clipboard.writeText(url);
      setCopyState('copied');
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopyState('copied');
      } catch {
        setCopyState('failed');
      }
    }

    if (copyTimeoutRef.current !== null) {
      window.clearTimeout(copyTimeoutRef.current);
    }

    copyTimeoutRef.current = window.setTimeout(() => setCopyState('idle'), 2000);
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper font-body text-ink-950">
      <PublicHeader />

      <main className="mx-auto w-full max-w-[1440px] flex-grow px-4 py-8 sm:px-6 lg:py-10">
        {status === 'loading' && <TrackingSkeleton />}

        {status === 'error' && (
          <section
            role="alert"
            aria-labelledby="tracking-error-heading"
            className="mx-auto max-w-xl rounded-xl border border-sand-300 bg-white p-6 text-center shadow-sm sm:p-8"
          >
            <div
              aria-hidden="true"
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-sand-200 text-ink-700"
            >
              <Search className="h-7 w-7" strokeWidth={1.8} />
            </div>
            <h1
              id="tracking-error-heading"
              className="font-display text-2xl font-bold tracking-tight text-ink-950"
            >
              No encontramos ese código.
            </h1>
            <p className="mt-2 text-sm text-ink-700">
              {serverMessage ?? 'Código de seguimiento inválido o no encontrado'}
            </p>

            <form className="mt-6 text-left" onSubmit={handleRetrySubmit} noValidate>
              <label
                htmlFor="retry-tracking-input"
                className="mb-2 block font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-500"
              >
                Código de seguimiento
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="retry-tracking-input"
                  name="codigo"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Ingresá tu código EY-XXXXXX"
                  value={retryCode}
                  onChange={(event) => {
                    setRetryCode(event.target.value);
                    setRetryError(null);
                  }}
                  aria-invalid={retryError ? true : undefined}
                  aria-describedby={retryError ? 'retry-tracking-error' : undefined}
                  className="h-11 flex-grow rounded-lg border border-sand-300 bg-white px-3 font-mono text-sm uppercase tracking-wider text-ink-900 placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-500 focus:border-route-600 focus:outline-none focus:ring-2 focus:ring-route-600"
                />
                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-ink-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-ink-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
                >
                  <Search aria-hidden="true" className="h-4 w-4" />
                  Buscar
                </button>
              </div>
              <p
                id="retry-tracking-error"
                aria-live="polite"
                className={clsx('mt-2 text-sm font-medium text-danger-600', !retryError && 'sr-only')}
              >
                {retryError}
              </p>
            </form>

            <div className="mt-6 border-t border-sand-200 pt-6">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded text-sm font-semibold text-route-600 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                Volver al inicio
              </Link>
            </div>
          </section>
        )}

        {status === 'success' && dto && (
          <>
            {/* Banner principal */}
            <section
              aria-labelledby="tracking-heading"
              className="mb-6 rounded-xl border border-sand-300 bg-white p-6 shadow-sm sm:p-8"
            >
              <div className="flex flex-col justify-between gap-6 border-b border-sand-200 pb-6 lg:flex-row lg:items-start">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-sand-200 px-3 py-1 font-mono text-sm font-semibold uppercase tracking-wider text-ink-900">
                      {dto.codigo}
                    </span>
                    <span
                      className={clsx(
                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
                        estadoMeta(dto.estado).chipClass,
                      )}
                    >
                      {estadoMeta(dto.estado).label}
                    </span>
                  </div>
                  <h1
                    id="tracking-heading"
                    className="pt-1 font-display text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl"
                  >
                    {estadoMeta(dto.estado).headline}
                  </h1>
                  <p className="text-lg font-medium text-ink-700">
                    Origen → Destino: {dto.origen.ciudad} → {dto.destino.ciudad}
                  </p>
                </div>

                <div className="flex flex-col items-start gap-1 lg:items-end">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-sand-300 bg-paper px-4 text-sm font-medium text-ink-700 transition-colors hover:bg-sand-200 hover:text-ink-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
                  >
                    {copyState === 'copied' ? (
                      <>
                        <Check aria-hidden="true" className="h-4 w-4 text-route-600" />
                        Enlace copiado
                      </>
                    ) : (
                      <>
                        <Copy aria-hidden="true" className="h-4 w-4" />
                        Copiar enlace
                      </>
                    )}
                  </button>
                  <span aria-live="polite" className="sr-only">
                    {copyState === 'copied'
                      ? 'Enlace copiado'
                      : copyState === 'failed'
                        ? 'No pudimos copiar el enlace'
                        : ''}
                  </span>
                  {copyState === 'failed' && (
                    <span className="text-xs font-medium text-danger-600">
                      No pudimos copiar el enlace
                    </span>
                  )}
                </div>
              </div>

              {/* Fechas + métricas rápidas */}
              <div className="grid grid-cols-2 gap-4 pt-6 sm:grid-cols-4">
                <div>
                  <span className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                    Creación
                  </span>
                  <span className="text-sm font-semibold text-ink-900">
                    {formatDateAr(dto.fechaCreacion)}
                  </span>
                </div>
                <div>
                  <span className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                    Entrega estimada
                  </span>
                  <span className="text-sm font-semibold text-ink-900">
                    {dto.fechaEntregaEstimada ? formatDateAr(dto.fechaEntregaEstimada) : 'A confirmar'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                    Bultos
                  </span>
                  <span className="text-sm font-semibold text-ink-900">
                    {dto.totalPaquetes} bultos · {formatPeso(dto.pesoTotalKg)} kg · {dto.totalEventos}{' '}
                    eventos
                  </span>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
              {/* Columna izquierda: timeline */}
              <section
                aria-labelledby="timeline-heading"
                className="rounded-xl border border-sand-300 bg-white p-6 shadow-sm sm:p-7 lg:col-span-7"
              >
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 pb-4">
                  <div>
                    <h2
                      id="timeline-heading"
                      className="font-display text-2xl font-bold text-ink-950"
                    >
                      Línea de tiempo de la carga
                    </h2>
                    <p className="mt-0.5 text-xs text-ink-500">
                      Registro cronológico de puntos de control y tránsito
                    </p>
                  </div>
                  <span className="rounded bg-sand-200 px-2 py-1 font-mono text-[11px] font-medium text-ink-700">
                    ZONA HORARIA ART (UTC-3)
                  </span>
                </div>

                {dto.ultimosEventos.length === 0 ? (
                  <p className="text-sm text-ink-500">
                    Todavía no hay eventos registrados para este envío.
                  </p>
                ) : (
                  <ol className="relative">
                    {dto.ultimosEventos.map((evento, index) => {
                      const isCurrent = index === dto.ultimosEventos.length - 1;
                      const isLast = index === dto.ultimosEventos.length - 1;

                      return (
                        <li
                          key={`${evento.timestamp}-${index}`}
                          className={clsx('relative pl-10', !isLast && 'pb-6')}
                        >
                          {!isLast && (
                            <span
                              aria-hidden="true"
                              className="absolute bottom-0 left-[7px] top-5 border-l-2 border-dashed border-sand-300"
                            />
                          )}

                          {isCurrent ? (
                            <span aria-hidden="true" className="absolute left-0 top-1 flex h-4 w-4">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-500 opacity-60" />
                              <span className="relative inline-flex h-4 w-4 rounded-full bg-signal-600 ring-4 ring-signal-600/15" />
                            </span>
                          ) : (
                            <span
                              aria-hidden="true"
                              className="absolute left-0 top-1 h-4 w-4 rounded-full bg-ink-950"
                            />
                          )}

                          <div
                            className={clsx(
                              isCurrent &&
                                'rounded-xl border border-signal-600/40 bg-paper p-4 ring-1 ring-signal-600',
                            )}
                          >
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3
                                  className={clsx(
                                    'font-display text-base font-semibold',
                                    isCurrent ? 'text-ink-950' : 'text-ink-900',
                                  )}
                                >
                                  {eventTitle(evento.tipo)}
                                </h3>
                                {isCurrent && (
                                  <span className="rounded bg-signal-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                    Punto actual
                                  </span>
                                )}
                              </div>
                              <time
                                dateTime={evento.timestamp}
                                className={clsx(
                                  'font-mono text-sm',
                                  isCurrent ? 'font-semibold text-ink-900' : 'text-ink-500',
                                )}
                              >
                                {formatEventTimestamp(evento.timestamp)}
                              </time>
                            </div>
                            {evento.descripcion && (
                              <p className="mt-1.5 text-sm leading-relaxed text-ink-700">
                                {evento.descripcion}
                              </p>
                            )}
                            <span className="mt-2 inline-flex items-center rounded border border-sand-200 bg-white px-2 py-0.5 font-mono text-[11px] font-medium text-ink-500">
                              {evento.estado}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>

              {/* Columna derecha: mapa + resumen */}
              <div className="space-y-6 lg:col-span-5">
                <section
                  aria-labelledby="map-heading"
                  className="overflow-hidden rounded-xl border border-sand-300 bg-white shadow-sm"
                >
                  <div className="flex items-center gap-2 border-b border-sand-200 p-4">
                    <MapIcon aria-hidden="true" className="h-5 w-5 text-route-600" />
                    <h2 id="map-heading" className="font-display text-lg font-bold text-ink-950">
                      Ruta
                    </h2>
                  </div>
                  {mapSupported ? (
                    <>
                      <div
                        ref={mapContainerRef}
                        className="h-[300px] w-full lg:h-[340px]"
                        role="img"
                        aria-label={`Mapa de la ruta de ${dto.origen.ciudad} a ${dto.destino.ciudad} con coordenadas aproximadas de sucursales`}
                      />
                      <p className="border-t border-sand-200 bg-paper p-3 text-xs text-ink-500">
                        Coordenadas aproximadas de sucursales (orientativas)
                      </p>
                    </>
                  ) : (
                    <div className="flex h-[300px] flex-col items-center justify-center gap-3 bg-paper p-6 text-center lg:h-[340px]">
                      <MapIcon aria-hidden="true" className="h-8 w-8 text-ink-500" />
                      <p className="text-base font-semibold text-ink-700">
                        Mapa disponible próximamente para esta ruta
                      </p>
                      <p className="max-w-xs text-sm text-ink-500">
                        Todavía no tenemos coordenadas aproximadas para una de las ciudades de esta
                        ruta.
                      </p>
                    </div>
                  )}
                </section>

                <section
                  aria-labelledby="resumen-heading"
                  className="rounded-xl border border-sand-300 bg-white p-6 shadow-sm"
                >
                  <h2
                    id="resumen-heading"
                    className="border-b border-sand-200 pb-3 font-display text-lg font-bold text-ink-950"
                  >
                    Resumen del envío
                  </h2>
                  <dl className="divide-y divide-sand-200 text-sm">
                    <div className="flex items-start justify-between gap-4 py-3">
                      <dt className="font-medium text-ink-500">Origen</dt>
                      <dd className="text-right font-medium text-ink-900">
                        {dto.origen.ciudad}
                        <span className="block text-xs font-normal text-ink-500">
                          {dto.origen.provincia}
                        </span>
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-4 py-3">
                      <dt className="font-medium text-ink-500">Destino</dt>
                      <dd className="text-right font-medium text-ink-900">
                        {dto.destino.ciudad}
                        <span className="block text-xs font-normal text-ink-500">
                          {dto.destino.provincia}
                        </span>
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-3">
                      <dt className="font-medium text-ink-500">Bultos / Peso</dt>
                      <dd className="font-mono font-semibold text-ink-900">
                        {dto.totalPaquetes} bultos · {formatPeso(dto.pesoTotalKg)} kg
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-3">
                      <dt className="font-medium text-ink-500">Creación</dt>
                      <dd className="font-medium text-ink-900">{formatDateAr(dto.fechaCreacion)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-3">
                      <dt className="font-medium text-ink-500">Despacho</dt>
                      <dd className="font-medium text-ink-900">{formatDateAr(dto.fechaDespacho)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-3">
                      <dt className="font-medium text-ink-500">Entrega estimada</dt>
                      <dd className="font-medium text-ink-900">
                        {formatDateAr(dto.fechaEntregaEstimada)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-3">
                      <dt className="font-medium text-ink-500">Entrega real</dt>
                      <dd className="font-medium text-ink-900">{formatDateAr(dto.fechaEntrega)}</dd>
                    </div>
                  </dl>

                  <div className="mt-4 rounded-xl border border-sand-300 bg-paper p-4">
                    <div className="flex items-center gap-2">
                      <LockOpen aria-hidden="true" className="h-5 w-5 text-signal-600" />
                      <h3 className="font-display text-base font-bold text-ink-950">
                        ¿Sos el destinatario?
                      </h3>
                    </div>
                    <p className="mt-1.5 text-sm text-ink-700">
                      Iniciá sesión para ver el detalle completo de tus envíos y gestionar la
                      entrega.
                    </p>
                    <Link
                      to="/login"
                      className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-lg bg-ink-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
                    >
                      Iniciar sesión para ver más
                    </Link>
                  </div>
                </section>
              </div>
            </div>

            {/* Soporte */}
            <section
              aria-labelledby="support-heading"
              className="mt-6 flex flex-col justify-between gap-4 rounded-xl border border-sand-300 bg-white p-6 shadow-sm md:flex-row md:items-center"
            >
              <div className="flex items-start gap-4">
                <div
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sand-200 text-ink-900"
                >
                  <Headset className="h-6 w-6" strokeWidth={1.8} />
                </div>
                <div>
                  <h2
                    id="support-heading"
                    className="font-display text-lg font-bold text-ink-950"
                  >
                    ¿Problemas o demoras con tu envío?
                  </h2>
                  <p className="mt-0.5 text-sm text-ink-700">
                    Nuestro equipo de operaciones está disponible todos los días para ayudarte.
                  </p>
                </div>
              </div>
              <a
                href="tel:08103333684"
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-sand-300 bg-paper px-5 font-mono text-sm font-bold text-ink-950 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
              >
                <Phone aria-hidden="true" className="h-4 w-4" />
                0810-333-ENVIOS
              </a>
            </section>
          </>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}

function TrackingSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="animate-pulse">
      <span className="sr-only">Cargando el seguimiento de tu envío…</span>

      <div aria-hidden="true" className="mb-6 rounded-xl border border-sand-300 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-8 w-28 rounded-lg bg-sand-200" />
          <div className="h-7 w-24 rounded-full bg-sand-200" />
        </div>
        <div className="mt-4 h-9 w-3/4 max-w-md rounded-lg bg-sand-200" />
        <div className="mt-3 h-5 w-1/2 max-w-xs rounded bg-sand-200" />
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-sand-200 pt-6 sm:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-10 rounded bg-sand-200" />
          ))}
        </div>
      </div>

      <div aria-hidden="true" className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-sand-300 bg-white p-6 lg:col-span-7">
          <div className="mb-6 h-8 w-64 rounded bg-sand-200" />
          <div className="space-y-6">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="flex items-start gap-4">
                <div className="h-4 w-4 shrink-0 rounded-full bg-sand-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-2/3 rounded bg-sand-200" />
                  <div className="h-4 w-full rounded bg-sand-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-6 lg:col-span-5">
          <div className="h-[300px] rounded-xl border border-sand-300 bg-white lg:h-[340px]" />
          <div className="h-64 rounded-xl border border-sand-300 bg-white" />
        </div>
      </div>
    </div>
  );
}
