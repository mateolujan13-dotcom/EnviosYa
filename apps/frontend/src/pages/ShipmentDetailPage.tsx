import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Printer,
  RotateCcw,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import type { ShipmentDetailDto, IDireccion, IPersona, IPaquete } from '@envioya/shared';
import { DashboardShell } from '../components/DashboardShell';
import { api, ApiError } from '../lib/api';
import {
  declaredValue,
  estadoMeta,
  eventTitle,
  formatArs,
  formatDateAr,
  formatDateTimeAr,
  formatNumberAr,
  formatWeightKg,
} from '../lib/shipmentMeta';

const MOTIVO_MIN = 3;
const MOTIVO_MAX = 500;

type FetchStatus = 'loading' | 'error' | 'not-found' | 'success';

export function ShipmentDetailPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const location = useLocation();

  const [status, setStatus] = useState<FetchStatus>('loading');
  const [dto, setDto] = useState<ShipmentDetailDto | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [createdDismissed, setCreatedDismissed] = useState(false);
  const [cancelStrip, setCancelStrip] = useState(false);
  const created = (location.state as { created?: boolean } | null)?.created === true;

  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copyTimeoutRef = useRef<number | null>(null);

  const [remitoVisible, setRemitoVisible] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrFailed, setQrFailed] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [motivoError, setMotivoError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const motivoRef = useRef<HTMLTextAreaElement | null>(null);
  const cancellingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    setStatus('loading');
    setDto(null);

    api<ShipmentDetailDto>(`/shipments/${encodeURIComponent(codigo ?? '')}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        setDto(data);
        setStatus('success');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof Error && error.name === 'AbortError') return;

        if (error instanceof ApiError && error.status === 404) {
          setStatus('not-found');
          return;
        }

        setStatus('error');
      });

    return () => controller.abort();
  }, [codigo, retryKey]);

  // Generate the QR lazily the first time the remito is shown.
  useEffect(() => {
    if (!remitoVisible || qrDataUrl || qrFailed || !dto) return;

    let cancelled = false;
    const url = `${window.location.origin}/seguimiento/${dto.codigo}`;

    QRCode.toDataURL(url, { width: 200, margin: 1 })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [remitoVisible, dto, qrDataUrl, qrFailed]);

  // Modal: Escape closes; focus the textarea on open.
  useEffect(() => {
    if (!cancelOpen) return undefined;

    motivoRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !cancellingRef.current) {
        setCancelOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cancelOpen]);

  // Clear the copy-feedback timer on unmount.
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const timeline = useMemo(
    () =>
      [...(dto?.ultimosEventos ?? [])].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      ),
    [dto],
  );

  const handleCopyCodigo = async () => {
    if (!dto) return;

    try {
      await navigator.clipboard.writeText(dto.codigo);
      setCopyState('copied');
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = dto.codigo;
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

  const openCancelModal = () => {
    setMotivo('');
    setMotivoError(null);
    setCancelError(null);
    setCancelOpen(true);
  };

  const handleCancelSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (cancellingRef.current) return;

    const trimmed = motivo.trim();

    if (trimmed.length < MOTIVO_MIN) {
      setMotivoError(`El motivo debe tener al menos ${MOTIVO_MIN} caracteres.`);
      return;
    }
    if (trimmed.length > MOTIVO_MAX) {
      setMotivoError(`El motivo no puede superar los ${MOTIVO_MAX} caracteres.`);
      return;
    }

    cancellingRef.current = true;
    setCancelling(true);
    setCancelError(null);
    setMotivoError(null);

    try {
      const updated = await api<ShipmentDetailDto>(
        `/shipments/${encodeURIComponent(codigo ?? '')}/cancel`,
        { method: 'POST', body: { motivo: trimmed } },
      );

      setDto(updated);
      setCancelOpen(false);
      setCancelStrip(true);
      setMotivo('');
    } catch (error) {
      if (error instanceof ApiError) {
        setCancelError(error.message);
      } else {
        setCancelError('No pudimos cancelar el envío. Verificá tu conexión e intentá nuevamente.');
      }
    } finally {
      cancellingRef.current = false;
      setCancelling(false);
    }
  };

  return (
    <DashboardShell badge="Portal del cliente">
      {status === 'loading' && <DetailSkeleton />}

      {status === 'not-found' && (
        <section
          role="alert"
          className="mx-auto max-w-xl rounded-xl border border-sand-300 bg-white p-6 sm:p-8 text-center shadow-sm"
        >
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-950">
            No encontramos ese envío.
          </h1>
          <p className="mt-2 text-sm text-ink-700">
            El código no existe o no pertenece a tu cuenta.
          </p>
          <Link
            to="/app/envios"
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-ink-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
          >
            Ver mis envíos
          </Link>
        </section>
      )}

      {status === 'error' && (
        <section
          role="alert"
          className="mx-auto max-w-xl rounded-xl border border-sand-300 bg-white p-6 sm:p-8 text-center shadow-sm"
        >
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-950">
            No pudimos cargar el envío.
          </h1>
          <p className="mt-2 text-sm text-ink-700">
            Verificá tu conexión e intentá nuevamente.
          </p>
          <button
            type="button"
            onClick={() => setRetryKey((key) => key + 1)}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg border border-sand-300 bg-paper px-5 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Reintentar
          </button>
        </section>
      )}

      {status === 'success' && dto && (
        <>
          {created && !createdDismissed && (
            <div
              role="status"
              className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-mint-300 bg-mint-100 px-4 py-3"
            >
              <p className="text-sm font-semibold text-ink-950">
                ¡Envío creado! Código{' '}
                <span className="font-mono uppercase">{dto.codigo}</span> — Llevalo a
                cualquier sucursal o esperá el retiro.
              </p>
              <button
                type="button"
                onClick={() => setCreatedDismissed(true)}
                aria-label="Ocultar aviso"
                className="shrink-0 rounded-lg p-1 text-ink-700 transition-colors hover:bg-mint-300/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          )}

          {cancelStrip && (
            <div
              role="status"
              className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-danger-600/40 bg-danger-100 px-4 py-3"
            >
              <p className="text-sm font-semibold text-danger-600">Envío cancelado.</p>
              <button
                type="button"
                onClick={() => setCancelStrip(false)}
                aria-label="Ocultar aviso"
                className="shrink-0 rounded-lg p-1 text-danger-600 transition-colors hover:bg-danger-600/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Header */}
          <section className="mb-6 rounded-xl border border-sand-300 bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-sand-200 px-3 py-1 font-mono text-sm font-semibold uppercase tracking-wider text-ink-900">
                    {dto.codigo}
                  </span>
                  {dto.cancelado ? (
                    <span className="inline-flex items-center rounded-full bg-danger-100 px-3 py-1 text-xs font-semibold text-danger-600">
                      Cancelado
                    </span>
                  ) : (
                    <span
                      className={clsx(
                        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
                        estadoMeta(dto.estado).chipClass,
                      )}
                    >
                      {estadoMeta(dto.estado).label}
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink-500">
                  {dto.remitente.direccion.ciudad} → {dto.destinatario.direccion.ciudad}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopyCodigo()}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-sand-300 bg-paper px-3 text-xs font-semibold text-ink-700 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
                >
                  {copyState === 'copied' ? (
                    <>
                      <Check aria-hidden="true" className="h-4 w-4 text-route-600" />
                      Código copiado
                    </>
                  ) : (
                    <>
                      <Copy aria-hidden="true" className="h-4 w-4" />
                      Copiar código
                    </>
                  )}
                </button>
                <Link
                  to={`/seguimiento/${dto.codigo}`}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-sand-300 bg-paper px-3 text-xs font-semibold text-route-600 transition-colors hover:bg-route-100/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
                >
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  Ver seguimiento público
                </Link>
              </div>
            </div>
            <span aria-live="polite" className="sr-only">
              {copyState === 'copied'
                ? 'Código copiado'
                : copyState === 'failed'
                  ? 'No pudimos copiar el código'
                  : ''}
            </span>

            {dto.cancelado && dto.motivoCancelacion && (
              <p
                role="note"
                className="mt-4 rounded-lg border border-danger-600/40 bg-danger-100 px-3 py-2 text-sm font-medium text-danger-600"
              >
                Motivo de cancelación: {dto.motivoCancelacion}
              </p>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="space-y-6 lg:col-span-7">
              {/* Resumen */}
              <section
                aria-labelledby="resumen-heading"
                className="rounded-xl border border-sand-300 bg-white p-5 sm:p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 pb-3 mb-4">
                  <h2
                    id="resumen-heading"
                    className="font-display font-bold text-lg text-ink-950"
                  >
                    Resumen del envío
                  </h2>
                  <div className="text-right">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                      Total
                    </p>
                    <p className="font-display font-bold text-2xl text-ink-950">
                      {formatArs(dto.costo.total)}
                    </p>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                      Origen
                    </dt>
                    <dd className="mt-0.5 font-medium text-ink-900">
                      {dto.remitente.direccion.ciudad}
                      <span className="block text-xs text-ink-500">
                        {dto.remitente.direccion.provincia}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                      Destino
                    </dt>
                    <dd className="mt-0.5 font-medium text-ink-900">
                      {dto.destinatario.direccion.ciudad}
                      <span className="block text-xs text-ink-500">
                        {dto.destinatario.direccion.provincia}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                      Bultos / Peso
                    </dt>
                    <dd className="mt-0.5 font-mono font-semibold text-ink-900">
                      {dto.totalPaquetes} · {formatWeightKg(dto.pesoTotalKg)} kg
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                      Creación
                    </dt>
                    <dd className="mt-0.5 font-medium text-ink-900">
                      {formatDateAr(dto.fechaCreacion)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                      Entrega estimada
                    </dt>
                    <dd className="mt-0.5 font-medium text-ink-900">
                      {dto.fechaEntregaEstimada ? formatDateAr(dto.fechaEntregaEstimada) : 'A confirmar'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                      Despacho
                    </dt>
                    <dd className="mt-0.5 font-medium text-ink-900">
                      {formatDateAr(dto.fechaDespacho)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                      Entrega real
                    </dt>
                    <dd className="mt-0.5 font-medium text-ink-900">
                      {formatDateAr(dto.fechaEntrega)}
                    </dd>
                  </div>
                </dl>
              </section>

              {/* Paquetes */}
              <section
                aria-labelledby="paquetes-heading"
                className="rounded-xl border border-sand-300 bg-white p-5 sm:p-6 shadow-sm"
              >
                <h2
                  id="paquetes-heading"
                  className="border-b border-sand-200 pb-3 mb-4 font-display font-bold text-lg text-ink-950"
                >
                  Paquetes ({dto.totalPaquetes})
                </h2>
                <ul className="divide-y divide-sand-200">
                  {dto.paquetes.map((paquete, index) => (
                    <PaqueteItem key={paquete.paqueteId ?? index} paquete={paquete} index={index} />
                  ))}
                </ul>
              </section>
            </div>

            {/* Timeline */}
            <section
              aria-labelledby="timeline-heading"
              className="rounded-xl border border-sand-300 bg-white p-5 sm:p-6 shadow-sm lg:col-span-5"
            >
              <div className="border-b border-sand-200 pb-3 mb-4">
                <h2
                  id="timeline-heading"
                  className="font-display font-bold text-lg text-ink-950"
                >
                  Línea de tiempo
                </h2>
                <p className="mt-0.5 text-xs text-ink-500">
                  {dto.totalEventos} {dto.totalEventos === 1 ? 'evento registrado' : 'eventos registrados'}
                </p>
              </div>

              {timeline.length === 0 ? (
                <p className="text-sm text-ink-500">
                  Todavía no hay eventos registrados para este envío.
                </p>
              ) : (
                <ol className="relative">
                  {timeline.map((evento, index) => {
                    const isCurrent = index === timeline.length - 1;
                    const isLast = index === timeline.length - 1;

                    return (
                      <li
                        key={`${evento.timestamp}-${index}`}
                        className={clsx('relative pl-9', !isLast && 'pb-5')}
                      >
                        {!isLast && (
                          <span
                            aria-hidden="true"
                            className="absolute bottom-0 left-[6px] top-5 border-l-2 border-dashed border-sand-300"
                          />
                        )}
                        {isCurrent ? (
                          <span aria-hidden="true" className="absolute left-0 top-1 flex h-3.5 w-3.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-500 opacity-60" />
                            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-signal-600 ring-4 ring-signal-600/15" />
                          </span>
                        ) : (
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-1 h-3.5 w-3.5 rounded-full bg-ink-950"
                          />
                        )}
                        <div
                          className={clsx(
                            isCurrent &&
                              'rounded-xl border border-signal-600/40 bg-paper p-3 ring-1 ring-signal-600',
                          )}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-display text-sm font-semibold text-ink-950">
                              {eventTitle(evento.tipo)}
                            </h3>
                            <time
                              dateTime={evento.timestamp}
                              className="font-mono text-xs text-ink-500"
                            >
                              {formatDateTimeAr(evento.timestamp)}
                            </time>
                          </div>
                          {evento.descripcion && (
                            <p className="mt-1 text-sm leading-snug text-ink-700">
                              {evento.descripcion}
                            </p>
                          )}
                          <span className="mt-1.5 inline-flex items-center rounded border border-sand-200 bg-white px-2 py-0.5 font-mono text-[10px] font-medium text-ink-500">
                            {estadoMeta(evento.estado).label}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </div>

          {/* Remito */}
          <section
            aria-labelledby="remito-heading"
            className="mt-6 rounded-xl border border-sand-300 bg-white shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
              <div>
                <h2
                  id="remito-heading"
                  className="font-display font-bold text-lg text-ink-950"
                >
                  Remito de despacho
                </h2>
                <p className="text-xs text-ink-500 mt-0.5">
                  Comprobante para llevar a la sucursal o para el retiro a domicilio.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRemitoVisible((visible) => !visible)}
                aria-expanded={remitoVisible}
                aria-controls="remito-panel"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-sand-300 bg-paper px-4 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
              >
                {remitoVisible ? 'Ocultar remito' : 'Ver remito'}
              </button>
            </div>

            {remitoVisible && (
              <div className="border-t border-sand-200 p-5 sm:p-6">
                <div
                  id="remito-panel"
                  data-print-remito
                  className="rounded-xl border border-sand-300 bg-paper p-5 sm:p-8"
                >
                  <div className="flex flex-wrap items-start justify-between gap-6 border-b border-sand-300 pb-5">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
                        EnvíoYa — Remito de despacho
                      </p>
                      <p className="mt-2 font-mono text-3xl sm:text-4xl font-bold uppercase tracking-widest text-ink-950">
                        {dto.codigo}
                      </p>
                      <p className="mt-1 text-xs text-ink-500">
                        {estadoMeta(dto.estado).label}
                        {dto.cancelado ? ' · Cancelado' : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      {qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt={`Código QR de seguimiento de ${dto.codigo}`}
                          width={140}
                          height={140}
                          className="h-32 w-32 sm:h-36 sm:w-36"
                        />
                      ) : (
                        <div
                          className="flex h-32 w-32 sm:h-36 sm:w-36 items-center justify-center rounded-lg border border-dashed border-sand-300 text-center text-[10px] text-ink-500"
                          role="img"
                          aria-label={
                            qrFailed
                              ? `No pudimos generar el QR; código: ${dto.codigo}`
                              : 'Generando código QR…'
                          }
                        >
                          {qrFailed ? dto.codigo : 'Generando QR…'}
                        </div>
                      )}
                      <p className="max-w-[160px] text-center font-mono text-[9px] leading-tight text-ink-500 break-all">
                        {window.location.origin}/seguimiento/{dto.codigo}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-5 text-sm">
                    <RemitoPersona
                      title="Remitente"
                      persona={dto.remitente}
                    />
                    <RemitoPersona
                      title="Destinatario"
                      persona={dto.destinatario}
                    />
                  </div>

                  <dl className="grid grid-cols-2 gap-4 border-t border-sand-300 pt-5 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                        Bultos
                      </dt>
                      <dd className="mt-0.5 font-mono font-semibold text-ink-950">
                        {dto.totalPaquetes}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                        Peso
                      </dt>
                      <dd className="mt-0.5 font-mono font-semibold text-ink-950">
                        {formatWeightKg(dto.pesoTotalKg)} kg
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                        Creación
                      </dt>
                      <dd className="mt-0.5 font-medium text-ink-950">
                        {formatDateAr(dto.fechaCreacion)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                        Total
                      </dt>
                      <dd className="mt-0.5 font-mono font-bold text-ink-950">
                        {formatArs(dto.costo.total)}
                      </dd>
                    </div>
                  </dl>
                </div>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="mt-4 inline-flex h-11 items-center gap-2 rounded-lg bg-ink-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
                >
                  <Printer aria-hidden="true" className="h-4 w-4" />
                  Imprimir remito
                </button>
              </div>
            )}
          </section>

          {/* Cancelación */}
          {!dto.cancelado && dto.estado === 'pendiente' && (
            <section className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-danger-600/30 bg-danger-100/40 p-5 sm:p-6">
              <div>
                <h2 className="font-display font-bold text-base text-ink-950">
                  ¿Necesitás cancelar este envío?
                </h2>
                <p className="text-sm text-ink-700 mt-0.5">
                  Solo podés cancelarlo mientras esté pendiente y sin repartidor asignado.
                </p>
              </div>
              <button
                type="button"
                onClick={openCancelModal}
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-danger-600 bg-white px-5 text-sm font-semibold text-danger-600 transition-colors hover:bg-danger-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-600"
              >
                Cancelar envío
              </button>
            </section>
          )}
        </>
      )}

      {/* Modal de cancelación */}
      {cancelOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-950/60 p-4"
          onClick={() => {
            if (!cancellingRef.current) setCancelOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-dialog-title"
            className="w-full max-w-md rounded-xl border border-sand-300 bg-white p-5 sm:p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2
                id="cancel-dialog-title"
                className="font-display font-bold text-xl text-ink-950"
              >
                Cancelar envío
              </h2>
              <button
                type="button"
                onClick={() => setCancelOpen(false)}
                disabled={cancelling}
                aria-label="Cerrar"
                className="rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 disabled:opacity-60"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 rounded-lg border border-danger-600/40 bg-danger-100 px-3 py-2 text-sm font-medium text-danger-600">
              Esta acción no se puede deshacer.
            </p>

            <form onSubmit={handleCancelSubmit} className="mt-4" noValidate>
              <label
                htmlFor="cancel-motivo"
                className="mb-1.5 block text-[13px] font-semibold text-ink-950"
              >
                Motivo de la cancelación <span className="text-signal-600">*</span>
              </label>
              <textarea
                id="cancel-motivo"
                ref={motivoRef}
                value={motivo}
                onChange={(event) => {
                  setMotivo(event.target.value);
                  setMotivoError(null);
                }}
                maxLength={MOTIVO_MAX}
                rows={4}
                placeholder="Ej: Me equivoqué en la dirección de entrega…"
                aria-invalid={motivoError ? true : undefined}
                aria-describedby={`cancel-motivo-counter${motivoError ? ' cancel-motivo-error' : ''}`}
                className={clsx(
                  'w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-ink-950 placeholder:text-ink-500/60 transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-route-600/25 focus:border-route-600',
                  motivoError ? 'border-danger-600 bg-danger-100/30' : 'border-sand-300',
                )}
              />
              <div className="mt-1 flex items-center justify-between gap-3">
                <p
                  id="cancel-motivo-error"
                  aria-live="polite"
                  className={clsx(
                    'text-xs font-medium text-danger-600',
                    !motivoError && 'sr-only',
                  )}
                >
                  {motivoError}
                </p>
                <p
                  id="cancel-motivo-counter"
                  className="ml-auto font-mono text-[11px] text-ink-500"
                >
                  {motivo.length}/{MOTIVO_MAX}
                </p>
              </div>

              {cancelError && (
                <p
                  role="alert"
                  className="mt-3 flex items-start gap-2 rounded-lg border border-danger-600/40 bg-danger-100 px-3 py-2 text-sm font-medium text-danger-600"
                >
                  <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                  {cancelError}
                </p>
              )}

              <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCancelOpen(false)}
                  disabled={cancelling}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-sand-300 bg-white px-5 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 disabled:opacity-60"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={cancelling || motivo.trim().length < MOTIVO_MIN}
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-danger-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-danger-600/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cancelling ? 'Cancelando…' : 'Confirmar cancelación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function formatAddress(direccion: IDireccion): string {
  return `${direccion.calle} ${direccion.numero}, ${direccion.ciudad}, ${direccion.provincia} · CP ${direccion.cp}`;
}

function RemitoPersona({ title, persona }: { title: string; persona: IPersona }) {
  return (
    <div>
      <h3 className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
        {title}
      </h3>
      <p className="mt-1 font-semibold text-ink-950">{persona.nombre}</p>
      <p className="text-ink-700">{persona.telefono}</p>
      <p className="mt-0.5 text-ink-700">{formatAddress(persona.direccion)}</p>
    </div>
  );
}

function PaqueteItem({ paquete, index }: { paquete: IPaquete; index: number }) {
  const valorDeclarado = declaredValue(paquete.caracteristicas);

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div>
        <p className="text-sm font-semibold text-ink-950">
          {index + 1}. {paquete.descripcion}
        </p>
        <p className="mt-0.5 font-mono text-xs text-ink-500">
          {formatNumberAr(paquete.dimensiones.altoCm)} ×{' '}
          {formatNumberAr(paquete.dimensiones.anchoCm)} ×{' '}
          {formatNumberAr(paquete.dimensiones.profundoCm)} cm ·{' '}
          {formatWeightKg(paquete.pesoKg)} kg
        </p>
        {valorDeclarado !== null && (
          <p className="mt-0.5 text-xs text-ink-500">
            Valor declarado: {formatArs(valorDeclarado)}
          </p>
        )}
      </div>
      {paquete.fragil && (
        <span className="inline-flex items-center rounded-full border border-warning-500/50 bg-warning-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-950">
          Frágil
        </span>
      )}
    </li>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-busy="true" className="animate-pulse space-y-6">
      <span className="sr-only">Cargando el detalle del envío…</span>
      <div className="rounded-xl border border-sand-300 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-32 rounded-lg bg-sand-200" />
            <div className="h-6 w-24 rounded-full bg-sand-200" />
          </div>
          <div className="h-10 w-64 rounded-lg bg-sand-200" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="space-y-6 lg:col-span-7">
          <div className="h-48 rounded-xl border border-sand-300 bg-white" />
          <div className="h-56 rounded-xl border border-sand-300 bg-white" />
        </div>
        <div className="h-80 rounded-xl border border-sand-300 bg-white lg:col-span-5" />
      </div>
    </div>
  );
}
