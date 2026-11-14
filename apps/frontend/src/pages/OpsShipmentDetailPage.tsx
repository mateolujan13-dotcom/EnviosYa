import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  RotateCcw,
  Truck,
  UserPlus,
  Warehouse,
  Wrench,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import type { OpsShipmentDetailDto, IPaquete } from '@envioya/shared';
import { DashboardShell } from '../components/DashboardShell';
import { api, ApiError } from '../lib/api';
import { REPARTIDORES_SUGERIDOS, VEHICULOS_SUGERIDOS } from '../lib/flota';
import { sucursalNombre } from '../lib/sucursales';
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

const OBSERVACION_MIN = 5;
const OBSERVACION_MAX = 500;

type FetchStatus = 'loading' | 'error' | 'not-found' | 'success';
type ConfirmAction = 'dispatch' | 'arrive' | 'deliver';
type PendingAction = ConfirmAction | 'assign' | 'incident' | 'resolve';

const CONFIRM_COPY: Record<
  ConfirmAction,
  { title: string; body: (codigo: string) => string; confirmLabel: string; endpoint: string; success: string }
> = {
  dispatch: {
    title: 'Despachar envío',
    body: (codigo) => `¿Confirmar despacho del envío ${codigo}?`,
    confirmLabel: 'Despachar',
    endpoint: 'dispatch',
    success: 'Envío despachado',
  },
  arrive: {
    title: 'Arribo a sucursal',
    body: () => '¿Confirmar arribo a sucursal destino?',
    confirmLabel: 'Confirmar arribo',
    endpoint: 'arrive',
    success: 'Arribo registrado',
  },
  deliver: {
    title: 'Entregar envío',
    body: () => '¿Confirmar entrega al destinatario?',
    confirmLabel: 'Confirmar entrega',
    endpoint: 'deliver',
    success: 'Envío entregado',
  },
};

const RESOLVE_OPTIONS = [
  { value: 'en_sucursal', label: 'Reingreso a sucursal' },
  { value: 'en_reparto', label: 'Reintento de entrega' },
  { value: 'devuelto', label: 'Devolución a origen' },
] as const;

export function OpsShipmentDetailPage() {
  const { codigo } = useParams<{ codigo: string }>();

  const [status, setStatus] = useState<FetchStatus>('loading');
  const [dto, setDto] = useState<OpsShipmentDetailDto | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copyTimeoutRef = useRef<number | null>(null);

  const [successStrip, setSuccessStrip] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<PendingAction | null>(null);
  const pendingRef = useRef(false);

  // Confirmation modal (dispatch / arrive / deliver)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Incident modal
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [observacion, setObservacion] = useState('');
  const [observacionError, setObservacionError] = useState<string | null>(null);
  const [incidentError, setIncidentError] = useState<string | null>(null);

  // Resolve-incident modal
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolucion, setResolucion] = useState<'en_sucursal' | 'en_reparto' | 'devuelto'>('en_sucursal');
  const [resolveObservacion, setResolveObservacion] = useState('');
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Asignación
  const [assignRepartidorId, setAssignRepartidorId] = useState('');
  const [assignVehiculoId, setAssignVehiculoId] = useState('');
  const [assignError, setAssignError] = useState<string | null>(null);
  const asignacionRef = useRef<HTMLElement | null>(null);
  const repartidorSelectRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setStatus('loading');
    setDto(null);

    api<OpsShipmentDetailDto>(`/ops/shipments/${encodeURIComponent(codigo ?? '')}`, {
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

  // Copy-feedback timer cleanup.
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

  const assignmentCapacity = useMemo(() => {
    const selected = VEHICULOS_SUGERIDOS.find((vehiculo) => vehiculo._id === assignVehiculoId);
    if (!selected) return null;

    const isCurrent = dto?.vehiculo?._id === selected._id;
    const cargaConsiderada = isCurrent ? (dto?.vehiculo?.cargaActualKg ?? 0) : 0;
    const residual = selected.capacidadKg - cargaConsiderada;
    const peso = dto?.pesoTotalKg ?? 0;

    return {
      selected,
      isCurrent,
      residual,
      fits: peso <= residual,
    };
  }, [assignVehiculoId, dto]);

  const handleCopyCodigo = async () => {
    if (!dto) return;

    try {
      await navigator.clipboard.writeText(dto.codigo);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }

    if (copyTimeoutRef.current !== null) {
      window.clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = window.setTimeout(() => setCopyState('idle'), 2000);
  };

  const runAction = async (
    action: PendingAction,
    request: () => Promise<OpsShipmentDetailDto>,
    onSuccess: (updated: OpsShipmentDetailDto) => void,
    onError: (message: string) => void,
  ) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setActionPending(action);

    try {
      const updated = await request();
      setDto(updated);
      onSuccess(updated);
    } catch (error) {
      if (error instanceof ApiError) {
        onError(error.message);
      } else {
        onError('No pudimos completar la acción. Verificá tu conexión e intentá nuevamente.');
      }
    } finally {
      pendingRef.current = false;
      setActionPending(null);
    }
  };

  const handleConfirmSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!confirmAction || !dto) return;

    const copy = CONFIRM_COPY[confirmAction];
    setConfirmError(null);

    await runAction(
      confirmAction,
      () =>
        api<OpsShipmentDetailDto>(
          `/ops/shipments/${encodeURIComponent(dto.codigo)}/${copy.endpoint}`,
          { method: 'POST' },
        ),
      () => {
        setConfirmAction(null);
        setSuccessStrip(copy.success);
      },
      setConfirmError,
    );
  };

  const handleAssignSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dto) return;

    if (!assignRepartidorId || !assignVehiculoId) {
      setAssignError('Seleccioná un repartidor y un vehículo.');
      return;
    }

    setAssignError(null);

    await runAction(
      'assign',
      () =>
        api<OpsShipmentDetailDto>(
          `/ops/shipments/${encodeURIComponent(dto.codigo)}/assign`,
          {
            method: 'POST',
            body: { repartidorId: assignRepartidorId, vehiculoId: assignVehiculoId },
          },
        ),
      () => {
        setSuccessStrip('Asignación confirmada');
        setAssignRepartidorId('');
        setAssignVehiculoId('');
      },
      setAssignError,
    );
  };

  const handleIncidentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dto) return;

    const trimmed = observacion.trim();

    if (trimmed.length < OBSERVACION_MIN) {
      setObservacionError(`La observación debe tener al menos ${OBSERVACION_MIN} caracteres.`);
      return;
    }

    setObservacionError(null);
    setIncidentError(null);

    await runAction(
      'incident',
      () =>
        api<OpsShipmentDetailDto>(
          `/ops/shipments/${encodeURIComponent(dto.codigo)}/incident`,
          { method: 'POST', body: { observacion: trimmed } },
        ),
      () => {
        setIncidentOpen(false);
        setObservacion('');
        setSuccessStrip('Incidencia registrada');
      },
      setIncidentError,
    );
  };

  const handleResolveSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dto) return;

    setResolveError(null);

    const trimmed = resolveObservacion.trim();
    const body = trimmed.length > 0 ? { resolucion, observacion: trimmed } : { resolucion };

    await runAction(
      'resolve',
      () =>
        api<OpsShipmentDetailDto>(
          `/ops/shipments/${encodeURIComponent(dto.codigo)}/resolve-incident`,
          { method: 'POST', body },
        ),
      () => {
        setResolveOpen(false);
        setResolveObservacion('');
        setSuccessStrip('Incidencia resuelta');
      },
      setResolveError,
    );
  };

  const scrollToAsignacion = () => {
    asignacionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    repartidorSelectRef.current?.focus({ preventScroll: true });
  };

  const busy = actionPending !== null;
  const cancelado = dto?.cancelado === true;
  const asignable = dto !== null && !cancelado && (dto.estado === 'pendiente' || dto.estado === 'en_sucursal');

  return (
    <DashboardShell badge="Torre de Control">
      {status === 'loading' && <DetailSkeleton />}

      {status === 'not-found' && (
        <section
          role="alert"
          className="mx-auto max-w-xl rounded-xl border border-sand-300 bg-white p-6 sm:p-8 text-center shadow-sm"
        >
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-950">
            No encontramos ese envío
          </h1>
          <p className="mt-2 text-sm text-ink-700">
            El código no existe en la operación.
          </p>
          <Link
            to="/ops/envios"
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-ink-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Volver a la bandeja
          </Link>
        </section>
      )}

      {status === 'error' && (
        <section
          role="alert"
          className="mx-auto max-w-xl rounded-xl border border-sand-300 bg-white p-6 sm:p-8 text-center shadow-sm"
        >
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-950">
            No pudimos cargar el envío
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
          {/* Header card */}
          <section className="mb-4 rounded-xl border border-sand-300 bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 pb-3">
              <Link
                to="/ops/envios"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 transition-colors hover:text-ink-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 rounded"
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                Volver a la bandeja
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-sand-200 px-3 py-1 font-mono text-sm font-semibold uppercase tracking-wider text-ink-900">
                  {dto.codigo}
                </span>
                {cancelado ? (
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
                <button
                  type="button"
                  onClick={() => void handleCopyCodigo()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-sand-300 bg-paper px-3 text-xs font-semibold text-ink-700 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
                >
                  {copyState === 'copied' ? (
                    <>
                      <Check aria-hidden="true" className="h-4 w-4 text-route-600" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy aria-hidden="true" className="h-4 w-4" />
                      Copiar código
                    </>
                  )}
                </button>
              </div>
            </div>
            <span aria-live="polite" className="sr-only">
              {copyState === 'copied'
                ? 'Código copiado'
                : copyState === 'failed'
                  ? 'No pudimos copiar el código'
                  : ''}
            </span>

            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-700">
              <span className="font-medium text-ink-950">
                {dto.origen.ciudad}, {dto.origen.provincia}
              </span>
              <ArrowRight aria-hidden="true" className="h-4 w-4 text-ink-500" />
              <span className="font-medium text-ink-950">
                {dto.destino.ciudad}, {dto.destino.provincia}
              </span>
            </p>

            <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-sand-200 pt-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                  Creación
                </dt>
                <dd className="mt-0.5 text-ink-900">{formatDateTimeAr(dto.fechaCreacion)}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                  Despacho
                </dt>
                <dd className="mt-0.5 text-ink-900">{formatDateAr(dto.fechaDespacho)}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                  Entrega estimada
                </dt>
                <dd className="mt-0.5 text-ink-900">
                  {dto.fechaEntregaEstimada ? formatDateAr(dto.fechaEntregaEstimada) : 'A confirmar'}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                  Entrega real
                </dt>
                <dd className="mt-0.5 text-ink-900">{formatDateAr(dto.fechaEntrega)}</dd>
              </div>
            </dl>
          </section>

          {cancelado && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-3 rounded-xl border border-danger-600/40 bg-danger-100 px-4 py-3"
            >
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-danger-600" />
              <div>
                <p className="text-sm font-bold text-danger-600">Este envío está cancelado</p>
                {dto.motivoCancelacion && (
                  <p className="mt-0.5 text-sm text-danger-600">
                    Motivo: {dto.motivoCancelacion}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-danger-600/90">
                  No hay acciones disponibles sobre un envío cancelado.
                </p>
              </div>
            </div>
          )}

          {successStrip && (
            <div
              role="status"
              className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-mint-300 bg-mint-100 px-4 py-3"
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-ink-950">
                <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-route-600" />
                {successStrip}
              </p>
              <button
                type="button"
                onClick={() => setSuccessStrip(null)}
                aria-label="Ocultar aviso"
                className="shrink-0 rounded-lg p-1 text-ink-700 transition-colors hover:bg-mint-300/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Acciones operativas */}
          <section
            aria-labelledby="acciones-heading"
            className="mb-4 rounded-xl border border-sand-300 bg-white p-5 sm:p-6 shadow-sm"
          >
            <h2
              id="acciones-heading"
              className="font-mono text-[11px] uppercase tracking-wider text-ink-500 font-semibold"
            >
              Acciones operativas
            </h2>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {!cancelado && dto.estado === 'pendiente' && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setConfirmError(null);
                      setConfirmAction('dispatch');
                    }}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-signal-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-signal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    <Truck aria-hidden="true" className="h-4 w-4" />
                    Despachar
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={scrollToAsignacion}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-ink-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    <UserPlus aria-hidden="true" className="h-4 w-4" />
                    Asignar recursos
                  </button>
                </>
              )}

              {!cancelado && dto.estado === 'en_transito' && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setConfirmError(null);
                      setConfirmAction('arrive');
                    }}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-signal-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-signal-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    <Warehouse aria-hidden="true" className="h-4 w-4" />
                    Arribo a sucursal destino
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setIncidentError(null);
                      setObservacionError(null);
                      setIncidentOpen(true);
                    }}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-danger-600 bg-white px-5 text-sm font-semibold text-danger-600 transition-colors hover:bg-danger-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    <AlertTriangle aria-hidden="true" className="h-4 w-4" />
                    Registrar incidencia
                  </button>
                </>
              )}

              {!cancelado && dto.estado === 'en_sucursal' && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={scrollToAsignacion}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-ink-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    <UserPlus aria-hidden="true" className="h-4 w-4" />
                    Asignar recursos
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setIncidentError(null);
                      setObservacionError(null);
                      setIncidentOpen(true);
                    }}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-danger-600 bg-white px-5 text-sm font-semibold text-danger-600 transition-colors hover:bg-danger-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    <AlertTriangle aria-hidden="true" className="h-4 w-4" />
                    Registrar incidencia
                  </button>
                </>
              )}

              {!cancelado && dto.estado === 'en_reparto' && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setConfirmError(null);
                      setConfirmAction('deliver');
                    }}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                    Entregar
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setIncidentError(null);
                      setObservacionError(null);
                      setIncidentOpen(true);
                    }}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-danger-600 bg-white px-5 text-sm font-semibold text-danger-600 transition-colors hover:bg-danger-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    <AlertTriangle aria-hidden="true" className="h-4 w-4" />
                    Registrar incidencia
                  </button>
                </>
              )}

              {!cancelado && dto.estado === 'con_incidencia' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setResolveError(null);
                    setResolveOpen(true);
                  }}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-route-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-route-600/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  <Wrench aria-hidden="true" className="h-4 w-4" />
                  Resolver incidencia
                </button>
              )}

              {(cancelado ||
                !['pendiente', 'en_transito', 'en_sucursal', 'en_reparto', 'con_incidencia'].includes(
                  dto.estado,
                )) && (
                <p className="text-sm text-ink-500">
                  {cancelado
                    ? 'El envío está cancelado: no hay acciones disponibles.'
                    : 'Sin acciones disponibles para este estado.'}
                </p>
              )}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className="space-y-4 lg:col-span-7">
              {/* Asignación de recursos */}
              <section
                ref={asignacionRef}
                aria-labelledby="asignacion-heading"
                className="rounded-xl border border-sand-300 bg-white p-5 sm:p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand-200 pb-3">
                  <h2
                    id="asignacion-heading"
                    className="font-display font-bold text-lg text-ink-950"
                  >
                    Asignación de recursos
                  </h2>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-ink-500">
                    {sucursalNombre(dto.sucursalActualId)}
                  </span>
                </div>

                {(dto.repartidor || dto.vehiculo) && (
                  <div className="mt-4 rounded-lg border border-sand-200 bg-paper p-4">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                      Asignación actual
                    </p>
                    <div className="mt-1.5 flex flex-col gap-1 text-sm">
                      <p className="font-semibold text-ink-950">
                        {dto.repartidor?.nombre ?? 'Sin repartidor'}
                        {dto.repartidor?.telefono && (
                          <span className="ml-2 font-mono text-xs font-normal text-ink-500">
                            {dto.repartidor.telefono}
                          </span>
                        )}
                      </p>
                      <p className="text-ink-700">
                        {dto.vehiculo
                          ? `${dto.vehiculo.patente} · ${dto.vehiculo.tipo}`
                          : 'Sin vehículo'}
                      </p>
                    </div>
                    {dto.vehiculo && dto.vehiculo.capacidadKg > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between gap-2 text-xs text-ink-700">
                          <span className="font-semibold">Carga del vehículo</span>
                          <span className="font-mono">
                            {formatWeightKg(dto.vehiculo.cargaActualKg)} /{' '}
                            {formatWeightKg(dto.vehiculo.capacidadKg)} kg
                          </span>
                        </div>
                        <div
                          className="mt-1 h-2 w-full overflow-hidden rounded-full bg-sand-200"
                          role="img"
                          aria-label={`Carga actual: ${formatWeightKg(dto.vehiculo.cargaActualKg)} de ${formatWeightKg(dto.vehiculo.capacidadKg)} kg`}
                        >
                          <div
                            className="h-full rounded-full bg-signal-600 transition-all duration-300"
                            style={{
                              width: `${Math.min(100, (dto.vehiculo.cargaActualKg / dto.vehiculo.capacidadKg) * 100)}%`,
                            }}
                          />
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-ink-500">
                          Capacidad residual:{' '}
                          {formatWeightKg(Math.max(0, dto.vehiculo.capacidadKg - dto.vehiculo.cargaActualKg))} kg
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <form onSubmit={handleAssignSubmit} className="mt-4" noValidate>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="assign-repartidor"
                        className="mb-1.5 block text-[13px] font-semibold text-ink-950"
                      >
                        Repartidor <span className="text-signal-600">*</span>
                      </label>
                      <select
                        id="assign-repartidor"
                        ref={repartidorSelectRef}
                        value={assignRepartidorId}
                        disabled={!asignable || busy}
                        onChange={(event) => {
                          setAssignRepartidorId(event.target.value);
                          setAssignError(null);
                        }}
                        className="h-11 w-full rounded-lg border border-sand-300 bg-white px-3 text-sm text-ink-950 focus:outline-none focus:ring-2 focus:ring-route-600/25 focus:border-route-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="">Seleccioná un repartidor…</option>
                        {REPARTIDORES_SUGERIDOS.map((repartidor) => (
                          <option key={repartidor._id} value={repartidor._id}>
                            {repartidor._id} · {repartidor.nombre} — {repartidor.sucursalBaseId}
                            {repartidor.estadoEnSemilla !== 'disponible'
                              ? ` (${repartidor.estadoEnSemilla === 'en_ruta' ? 'en ruta' : repartidor.estadoEnSemilla} en semilla)`
                              : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="assign-vehiculo"
                        className="mb-1.5 block text-[13px] font-semibold text-ink-950"
                      >
                        Vehículo <span className="text-signal-600">*</span>
                      </label>
                      <select
                        id="assign-vehiculo"
                        value={assignVehiculoId}
                        disabled={!asignable || busy}
                        onChange={(event) => {
                          setAssignVehiculoId(event.target.value);
                          setAssignError(null);
                        }}
                        className="h-11 w-full rounded-lg border border-sand-300 bg-white px-3 text-sm text-ink-950 focus:outline-none focus:ring-2 focus:ring-route-600/25 focus:border-route-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="">Seleccioná un vehículo…</option>
                        {VEHICULOS_SUGERIDOS.map((vehiculo) => (
                          <option key={vehiculo._id} value={vehiculo._id}>
                            {vehiculo.patente} · {vehiculo.tipo} {vehiculo.marca} {vehiculo.modelo} —{' '}
                            {formatWeightKg(vehiculo.capacidadKg)} kg
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <p className="mt-2 font-mono text-[11px] text-ink-500">
                    Disponibilidad validada por el servidor al confirmar.
                  </p>

                  {assignmentCapacity && (
                    <div className="mt-2 rounded-lg border border-sand-200 bg-paper px-3 py-2 text-xs text-ink-700">
                      <p>
                        {assignmentCapacity.isCurrent
                          ? 'Carga actual informada por el servidor: '
                          : 'Asumimos carga actual 0 kg para este vehículo; '}
                        capacidad residual estimada:{' '}
                        <strong className="font-mono">
                          {formatWeightKg(assignmentCapacity.residual)} kg
                        </strong>
                        .
                      </p>
                      {!assignmentCapacity.fits && (
                        <p
                          role="alert"
                          className="mt-1.5 flex items-start gap-1.5 rounded border border-warning-500/50 bg-warning-500/10 px-2 py-1.5 font-semibold text-ink-950"
                        >
                          <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          El peso del envío ({formatWeightKg(dto.pesoTotalKg)} kg) supera la
                          capacidad residual estimada. El servidor validará al confirmar.
                        </p>
                      )}
                    </div>
                  )}

                  {!asignable && !cancelado && (
                    <p role="note" className="mt-2 text-xs text-ink-500">
                      La asignación solo está disponible en estados Pendiente o En sucursal.
                    </p>
                  )}

                  {assignError && (
                    <p
                      role="alert"
                      className="mt-3 flex items-start gap-2 rounded-lg border border-danger-600/40 bg-danger-100 px-3 py-2 text-sm font-medium text-danger-600"
                    >
                      <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                      {assignError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={!asignable || busy || !assignRepartidorId || !assignVehiculoId}
                    className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {actionPending === 'assign' ? 'Confirmando…' : 'Confirmar asignación'}
                  </button>
                </form>
              </section>

              {/* Paquetes */}
              <section
                aria-labelledby="paquetes-heading"
                className="rounded-xl border border-sand-300 bg-white p-5 sm:p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand-200 pb-3">
                  <h2
                    id="paquetes-heading"
                    className="font-display font-bold text-lg text-ink-950"
                  >
                    Paquetes
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] bg-sand-200 px-2 py-0.5 rounded text-ink-700">
                      {dto.totalPaquetes} {dto.totalPaquetes === 1 ? 'bulto' : 'bultos'}
                    </span>
                    <span className="font-mono text-[11px] bg-route-100 text-route-600 px-2 py-0.5 rounded">
                      {formatWeightKg(dto.pesoTotalKg)} kg
                    </span>
                  </div>
                </div>
                <ul className="divide-y divide-sand-200">
                  {dto.paquetes.map((paquete, index) => (
                    <PaqueteItem key={paquete.paqueteId ?? index} paquete={paquete} index={index} />
                  ))}
                </ul>
              </section>

              {/* Resumen / costo */}
              <section
                aria-labelledby="resumen-heading"
                className="rounded-xl border border-sand-300 bg-white p-5 sm:p-6 shadow-sm"
              >
                <h2
                  id="resumen-heading"
                  className="border-b border-sand-200 pb-3 font-display font-bold text-lg text-ink-950"
                >
                  Resumen
                </h2>
                <dl className="grid grid-cols-2 gap-4 pt-4 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                      Bultos
                    </dt>
                    <dd className="mt-0.5 font-mono font-semibold text-ink-900">
                      {dto.totalPaquetes}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                      Peso total
                    </dt>
                    <dd className="mt-0.5 font-mono font-semibold text-ink-900">
                      {formatWeightKg(dto.pesoTotalKg)} kg
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                      Sucursal actual
                    </dt>
                    <dd className="mt-0.5 font-medium text-ink-900">
                      {sucursalNombre(dto.sucursalActualId)}
                    </dd>
                  </div>
                </dl>
                <dl className="mt-4 divide-y divide-sand-200 border-t border-sand-200 text-sm">
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-ink-700">Flete</dt>
                    <dd className="font-mono text-ink-900">{formatArs(dto.costo.flete)}</dd>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-ink-700">Recargos</dt>
                    <dd className="font-mono text-ink-900">{formatArs(dto.costo.recargos)}</dd>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-ink-700">Seguro</dt>
                    <dd className="font-mono text-ink-900">{formatArs(dto.costo.seguro)}</dd>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <dt className="font-semibold text-ink-950">Total</dt>
                    <dd className="font-mono font-bold text-ink-950">{formatArs(dto.costo.total)}</dd>
                  </div>
                </dl>
              </section>
            </div>

            <div className="space-y-4 lg:col-span-5">
              {/* Timeline */}
              <section
                aria-labelledby="timeline-heading"
                className="rounded-xl border border-sand-300 bg-white p-5 sm:p-6 shadow-sm"
              >
                <div className="border-b border-sand-200 pb-3">
                  <h2
                    id="timeline-heading"
                    className="font-display font-bold text-lg text-ink-950"
                  >
                    Línea de tiempo
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {dto.totalEventos}{' '}
                    {dto.totalEventos === 1 ? 'evento registrado' : 'eventos registrados'}
                  </p>
                </div>

                {timeline.length === 0 ? (
                  <p className="pt-4 text-sm text-ink-500">
                    Todavía no hay eventos registrados para este envío.
                  </p>
                ) : (
                  <ol className="relative pt-4">
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
                                {isCurrent && (
                                  <span className="ml-2 rounded-full bg-signal-600/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-signal-600 align-middle">
                                    Punto actual
                                  </span>
                                )}
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

              {/* Cliente + remitente/destinatario */}
              <section
                aria-labelledby="cliente-heading"
                className="rounded-xl border border-sand-300 bg-white p-5 sm:p-6 shadow-sm"
              >
                <h2
                  id="cliente-heading"
                  className="border-b border-sand-200 pb-3 font-display font-bold text-lg text-ink-950"
                >
                  Cliente
                </h2>
                <div className="pt-3">
                  <p className="font-semibold text-ink-950">{dto.clienteResumen.nombre}</p>
                  {dto.clienteResumen.email && (
                    <a
                      href={`mailto:${dto.clienteResumen.email}`}
                      className="text-sm text-route-600 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 rounded"
                    >
                      {dto.clienteResumen.email}
                    </a>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 border-t border-sand-200 pt-4 sm:grid-cols-2">
                  <PersonaSummary title="Remitente" persona={dto.remitente} />
                  <PersonaSummary title="Destinatario" persona={dto.destinatario} />
                </div>
              </section>
            </div>
          </div>
        </>
      )}

      {/* Confirmación: dispatch / arrive / deliver */}
      {confirmAction && dto && (
        <Modal
          title={CONFIRM_COPY[confirmAction].title}
          onClose={() => {
            if (!pendingRef.current) setConfirmAction(null);
          }}
          busy={actionPending === confirmAction}
        >
          <form onSubmit={handleConfirmSubmit} noValidate>
            <p className="text-sm text-ink-700">{CONFIRM_COPY[confirmAction].body(dto.codigo)}</p>

            {confirmError && (
              <p
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-lg border border-danger-600/40 bg-danger-100 px-3 py-2 text-sm font-medium text-danger-600"
              >
                <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                {confirmError}
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={actionPending === confirmAction}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-sand-300 bg-white px-5 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 disabled:opacity-60"
              >
                Volver
              </button>
              <button
                type="submit"
                autoFocus
                disabled={actionPending === confirmAction}
                className={clsx(
                  'inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 disabled:cursor-not-allowed disabled:opacity-60',
                  confirmAction === 'deliver'
                    ? 'bg-ink-950 hover:bg-ink-900'
                    : 'bg-signal-600 hover:bg-signal-500',
                )}
              >
                {actionPending === confirmAction
                  ? 'Confirmando…'
                  : CONFIRM_COPY[confirmAction].confirmLabel}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Registrar incidencia */}
      {incidentOpen && dto && (
        <Modal
          title="Registrar incidencia"
          onClose={() => {
            if (!pendingRef.current) setIncidentOpen(false);
          }}
          busy={actionPending === 'incident'}
        >
          <form onSubmit={handleIncidentSubmit} noValidate>
            <label
              htmlFor="incident-observacion"
              className="mb-1.5 block text-[13px] font-semibold text-ink-950"
            >
              Observación <span className="text-signal-600">*</span>
            </label>
            <textarea
              id="incident-observacion"
              autoFocus
              value={observacion}
              onChange={(event) => {
                setObservacion(event.target.value);
                setObservacionError(null);
              }}
              maxLength={OBSERVACION_MAX}
              rows={4}
              placeholder="Ej: Cliente ausente en la dirección indicada…"
              aria-invalid={observacionError ? true : undefined}
              aria-describedby={`incident-counter${observacionError ? ' incident-error' : ''}`}
              className={clsx(
                'w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-ink-950 placeholder:text-ink-500/60 transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-route-600/25 focus:border-route-600',
                observacionError ? 'border-danger-600 bg-danger-100/30' : 'border-sand-300',
              )}
            />
            <div className="mt-1 flex items-center justify-between gap-3">
              <p
                id="incident-error"
                aria-live="polite"
                className={clsx(
                  'text-xs font-medium text-danger-600',
                  !observacionError && 'sr-only',
                )}
              >
                {observacionError}
              </p>
              <p id="incident-counter" className="ml-auto font-mono text-[11px] text-ink-500">
                {observacion.length}/{OBSERVACION_MAX} · mínimo {OBSERVACION_MIN}
              </p>
            </div>

            {incidentError && (
              <p
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-lg border border-danger-600/40 bg-danger-100 px-3 py-2 text-sm font-medium text-danger-600"
              >
                <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                {incidentError}
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                onClick={() => setIncidentOpen(false)}
                disabled={actionPending === 'incident'}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-sand-300 bg-white px-5 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 disabled:opacity-60"
              >
                Volver
              </button>
              <button
                type="submit"
                disabled={actionPending === 'incident' || observacion.trim().length < OBSERVACION_MIN}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-danger-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-danger-600/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionPending === 'incident' ? 'Registrando…' : 'Registrar incidencia'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Resolver incidencia */}
      {resolveOpen && dto && (
        <Modal
          title="Resolver incidencia"
          onClose={() => {
            if (!pendingRef.current) setResolveOpen(false);
          }}
          busy={actionPending === 'resolve'}
        >
          <form onSubmit={handleResolveSubmit} noValidate>
            <label
              htmlFor="resolve-resolucion"
              className="mb-1.5 block text-[13px] font-semibold text-ink-950"
            >
              Resolución <span className="text-signal-600">*</span>
            </label>
            <select
              id="resolve-resolucion"
              autoFocus
              value={resolucion}
              onChange={(event) =>
                setResolucion(event.target.value as 'en_sucursal' | 'en_reparto' | 'devuelto')
              }
              className="h-11 w-full rounded-lg border border-sand-300 bg-white px-3 text-sm text-ink-950 focus:outline-none focus:ring-2 focus:ring-route-600/25 focus:border-route-600"
            >
              {RESOLVE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <label
              htmlFor="resolve-observacion"
              className="mb-1.5 mt-4 block text-[13px] font-semibold text-ink-950"
            >
              Observación <span className="font-normal text-ink-500">(opcional)</span>
            </label>
            <textarea
              id="resolve-observacion"
              value={resolveObservacion}
              onChange={(event) => setResolveObservacion(event.target.value)}
              maxLength={OBSERVACION_MAX}
              rows={3}
              placeholder="Detalle de la resolución…"
              className="w-full rounded-lg border border-sand-300 bg-white px-3.5 py-2.5 text-sm text-ink-950 placeholder:text-ink-500/60 focus:outline-none focus:ring-2 focus:ring-route-600/25 focus:border-route-600"
            />

            {resolveError && (
              <p
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-lg border border-danger-600/40 bg-danger-100 px-3 py-2 text-sm font-medium text-danger-600"
              >
                <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                {resolveError}
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                onClick={() => setResolveOpen(false)}
                disabled={actionPending === 'resolve'}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-sand-300 bg-white px-5 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 disabled:opacity-60"
              >
                Volver
              </button>
              <button
                type="submit"
                disabled={actionPending === 'resolve'}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-route-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-route-600/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionPending === 'resolve' ? 'Resolviendo…' : 'Resolver'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </DashboardShell>
  );
}

function Modal({
  title,
  onClose,
  busy,
  children,
}: {
  title: string;
  onClose: () => void;
  busy: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, busy]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-950/60 p-4"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-xl border border-sand-300 bg-white p-5 sm:p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-sand-200 pb-3">
          <h2 className="font-display font-bold text-xl text-ink-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 disabled:opacity-60"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="pt-4">{children}</div>
      </div>
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

function PersonaSummary({
  title,
  persona,
}: {
  title: string;
  persona: OpsShipmentDetailDto['remitente'];
}) {
  return (
    <div className="rounded-lg border border-sand-200 bg-paper p-3">
      <h3 className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
        {title}
      </h3>
      <p className="mt-1 font-semibold text-ink-950">{persona.nombre}</p>
      <p className="text-xs text-ink-700">
        {persona.direccion.ciudad}, {persona.direccion.provincia}
      </p>
      <p className="mt-0.5 font-mono text-[11px] text-ink-500">{persona.telefono}</p>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-busy="true" className="animate-pulse space-y-4">
      <span className="sr-only">Cargando el envío…</span>
      <div className="rounded-xl border border-sand-300 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-32 rounded-lg bg-sand-200" />
            <div className="h-6 w-24 rounded-full bg-sand-200" />
          </div>
          <div className="h-9 w-40 rounded-lg bg-sand-200" />
        </div>
        <div className="mt-4 h-6 w-64 rounded bg-sand-200" />
      </div>
      <div className="rounded-xl border border-sand-300 bg-white p-6">
        <div className="h-5 w-40 rounded bg-sand-200" />
        <div className="mt-3 h-12 w-72 rounded-lg bg-sand-200" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="space-y-4 lg:col-span-7">
          <div className="h-64 rounded-xl border border-sand-300 bg-white" />
          <div className="h-48 rounded-xl border border-sand-300 bg-white" />
        </div>
        <div className="h-96 rounded-xl border border-sand-300 bg-white lg:col-span-5" />
      </div>
    </div>
  );
}
