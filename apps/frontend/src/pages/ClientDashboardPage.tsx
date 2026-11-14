import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CircleDollarSign,
  ListChecks,
  Package,
  PackageCheck,
  Plus,
  Search,
  Truck,
} from 'lucide-react';
import clsx from 'clsx';
import type {
  ShipmentListItemDto,
  ShipmentsPageDto,
  ShipmentsSummaryDto,
} from '@envioya/shared';
import { useAuth } from '../auth/AuthContext';
import { DashboardShell } from '../components/DashboardShell';
import { api } from '../lib/api';
import {
  estadoMeta,
  formatArs,
  formatDateAr,
  TRACKING_CODE_PATTERN,
} from '../lib/shipmentMeta';

type SummaryStatus = 'loading' | 'error' | 'success';
type RecentStatus = 'loading' | 'error' | 'success';

export function ClientDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = user?.nombre.split(/\s+/)[0] ?? '';

  const [summaryStatus, setSummaryStatus] = useState<SummaryStatus>('loading');
  const [summary, setSummary] = useState<ShipmentsSummaryDto | null>(null);
  const [summaryReloadKey, setSummaryReloadKey] = useState(0);

  const [recentStatus, setRecentStatus] = useState<RecentStatus>('loading');
  const [recent, setRecent] = useState<ShipmentListItemDto[]>([]);
  const [recentReloadKey, setRecentReloadKey] = useState(0);

  const [trackCode, setTrackCode] = useState('');
  const [trackError, setTrackError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setSummaryStatus('loading');

    api<ShipmentsSummaryDto>('/shipments/summary', { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setSummary(data);
        setSummaryStatus('success');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof Error && error.name === 'AbortError') return;
        setSummary(null);
        setSummaryStatus('error');
      });

    return () => controller.abort();
  }, [summaryReloadKey]);

  useEffect(() => {
    const controller = new AbortController();

    setRecentStatus('loading');

    api<ShipmentsPageDto>('/shipments?limit=5', { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setRecent(data.items);
        setRecentStatus('success');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof Error && error.name === 'AbortError') return;
        setRecent([]);
        setRecentStatus('error');
      });

    return () => controller.abort();
  }, [recentReloadKey]);

  const handleTrackSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalized = trackCode.trim().toUpperCase();

    if (!TRACKING_CODE_PATTERN.test(normalized)) {
      setTrackError('Ingresá un código válido con formato EY-XXXXXX.');
      return;
    }

    setTrackError(null);
    navigate(`/seguimiento/${normalized}`);
  };

  return (
    <DashboardShell badge="Portal del cliente">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-signal-600 font-semibold mb-1">
            Panel de cliente
          </p>
          <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-ink-950">
            Hola, {firstName}
          </h1>
          <p className="text-sm text-ink-500 mt-1">
            Acá vas a encontrar tus envíos, su seguimiento y tu actividad del mes.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 self-start md:self-auto px-3 py-1.5 rounded-full bg-white border border-sand-200 text-xs font-medium text-ink-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Sesión activa
        </span>
      </section>

      {/* KPIs */}
      {summaryStatus === 'loading' && <SummarySkeleton />}

      {summaryStatus === 'error' && (
        <section
          role="alert"
          className="mb-8 rounded-xl border border-sand-300 bg-white p-6 text-center shadow-sm"
        >
          <p className="text-sm font-semibold text-ink-950">
            No pudimos cargar el resumen
          </p>
          <p className="text-xs text-ink-500 mt-1">
            Verificá tu conexión e intentá nuevamente.
          </p>
          <button
            type="button"
            onClick={() => setSummaryReloadKey((key) => key + 1)}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-sand-300 bg-paper px-4 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
          >
            Reintentar
          </button>
        </section>
      )}

      {summaryStatus === 'success' && summary && (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <SummaryCard
            label="Envíos activos"
            value={String(summary.activos)}
            detail={`${summary.totalEnvios} envíos en total`}
            icon={Truck}
            tone="bg-route-100 text-route-600"
          />
          <SummaryCard
            label="Entregados este mes"
            value={String(summary.entregadosEsteMes)}
            detail="Entregas confirmadas del mes"
            icon={PackageCheck}
            tone="bg-mint-100 text-ink-700"
          />
          <SummaryCard
            label="Gasto del mes"
            value={formatArs(summary.gastoDelMes)}
            detail="Total facturado del mes"
            icon={CircleDollarSign}
            tone="bg-sand-200 text-ink-700"
          />
        </section>
      )}

      {/* Acciones rápidas */}
      <section className="mb-8">
        <h2 className="font-display font-bold text-lg text-ink-950 mb-3">
          Acciones rápidas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/app/nuevo"
            className="group bg-white border border-sand-200 rounded-xl p-5 shadow-sm transition-colors hover:border-route-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
          >
            <span className="w-9 h-9 rounded-lg bg-route-100 text-route-600 flex items-center justify-center mb-3">
              <Plus className="w-[18px] h-[18px]" aria-hidden="true" />
            </span>
            <p className="text-sm font-semibold text-ink-950">Cotizar un envío</p>
            <p className="text-xs text-ink-500 mt-1">
              Calculá el costo y creá tu próximo paquete.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-route-600">
              Empezar
              <ArrowRight
                aria-hidden="true"
                className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
              />
            </span>
          </Link>

          <Link
            to="/app/envios"
            className="group bg-white border border-sand-200 rounded-xl p-5 shadow-sm transition-colors hover:border-route-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
          >
            <span className="w-9 h-9 rounded-lg bg-sand-200 text-ink-700 flex items-center justify-center mb-3">
              <ListChecks className="w-[18px] h-[18px]" aria-hidden="true" />
            </span>
            <p className="text-sm font-semibold text-ink-950">Mis envíos</p>
            <p className="text-xs text-ink-500 mt-1">
              Revisá el historial y el estado de tus envíos.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-route-600">
              Ver historial
              <ArrowRight
                aria-hidden="true"
                className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
              />
            </span>
          </Link>

          <form
            onSubmit={handleTrackSubmit}
            noValidate
            className="bg-white border border-sand-200 rounded-xl p-5 shadow-sm"
          >
            <span className="w-9 h-9 rounded-lg bg-sand-200 text-ink-700 flex items-center justify-center mb-3">
              <Search className="w-[18px] h-[18px]" aria-hidden="true" />
            </span>
            <label
              htmlFor="dashboard-track-input"
              className="text-sm font-semibold text-ink-950"
            >
              Seguir un envío
            </label>
            <div className="mt-2 flex flex-col gap-2">
              <input
                id="dashboard-track-input"
                name="codigo"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="EY-XXXXXX"
                value={trackCode}
                onChange={(event) => {
                  setTrackCode(event.target.value);
                  setTrackError(null);
                }}
                aria-invalid={trackError ? true : undefined}
                aria-describedby={trackError ? 'dashboard-track-error' : undefined}
                className="h-10 w-full rounded-lg border border-sand-300 bg-white px-3 font-mono text-sm uppercase tracking-wider text-ink-900 placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-500 focus:border-route-600 focus:outline-none focus:ring-2 focus:ring-route-600"
              />
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ink-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
              >
                <Search aria-hidden="true" className="h-4 w-4" />
                Buscar
              </button>
            </div>
            <p
              id="dashboard-track-error"
              aria-live="polite"
              className={clsx(
                'mt-2 text-xs font-medium text-danger-600',
                !trackError && 'sr-only',
              )}
            >
              {trackError}
            </p>
          </form>
        </div>
      </section>

      {/* Últimos envíos */}
      <section aria-labelledby="recent-heading">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2
            id="recent-heading"
            className="font-display font-bold text-lg text-ink-950"
          >
            Últimos envíos
          </h2>
          {recentStatus === 'success' && recent.length > 0 && (
            <Link
              to="/app/envios"
              className="inline-flex items-center gap-1 text-sm font-semibold text-route-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 rounded"
            >
              Ver todos
              <ArrowRight aria-hidden="true" className="w-4 h-4" />
            </Link>
          )}
        </div>

        {recentStatus === 'loading' && <RecentSkeleton />}

        {recentStatus === 'error' && (
          <div
            role="alert"
            className="rounded-xl border border-sand-300 bg-white p-6 text-center shadow-sm"
          >
            <p className="text-sm font-semibold text-ink-950">
              No pudimos cargar tus últimos envíos
            </p>
            <button
              type="button"
              onClick={() => setRecentReloadKey((key) => key + 1)}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-sand-300 bg-paper px-4 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
            >
              Reintentar
            </button>
          </div>
        )}

        {recentStatus === 'success' && recent.length === 0 && (
          <div className="rounded-xl border border-sand-200 bg-white p-8 sm:p-10 text-center shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-sand-200/70 text-ink-700 flex items-center justify-center mx-auto mb-4">
              <Package className="w-7 h-7" aria-hidden="true" />
            </div>
            <h3 className="font-display font-bold text-xl text-ink-950">
              Todavía no tenés envíos
            </h3>
            <p className="text-sm text-ink-500 max-w-md mx-auto mt-1.5">
              Cuando crees tu primer envío vas a ver acá su estado, su recorrido y
              el costo con todos los detalles.
            </p>
            <Link
              to="/app/nuevo"
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-ink-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
            >
              <Plus aria-hidden="true" className="w-4 h-4" />
              Cotizá tu primer envío
            </Link>
          </div>
        )}

        {recentStatus === 'success' && recent.length > 0 && (
          <ul className="divide-y divide-sand-200 rounded-xl border border-sand-200 bg-white shadow-sm overflow-hidden">
            {recent.map((item) => {
              const meta = estadoMeta(item.estado);

              return (
                <li key={item.codigo}>
                  <Link
                    to={`/app/envios/${item.codigo}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5 transition-colors hover:bg-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-route-600"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-lg bg-sand-200 px-2.5 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-ink-900">
                        {item.codigo}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-ink-950">
                          {item.destinoCiudad}
                        </p>
                        <p className="text-[11px] text-ink-500">
                          {formatDateAr(item.fechaCreacion)} · {item.totalPaquetes}{' '}
                          {item.totalPaquetes === 1 ? 'bulto' : 'bultos'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4">
                      {item.cancelado ? (
                        <span className="inline-flex items-center rounded-full bg-danger-100 px-3 py-1 text-xs font-semibold text-danger-600">
                          Cancelado
                        </span>
                      ) : (
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
                            meta.chipClass,
                          )}
                        >
                          {meta.label}
                        </span>
                      )}
                      <span className="font-mono text-sm font-semibold text-ink-950">
                        {formatArs(item.total)}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </DashboardShell>
  );
}

interface SummaryCardProps {
  label: string;
  value: string;
  detail: string;
  icon: typeof Truck;
  tone: string;
}

function SummaryCard({ label, value, detail, icon: Icon, tone }: SummaryCardProps) {
  return (
    <article className="bg-white border border-sand-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-ink-500">{label}</p>
          <p className="font-display font-bold text-2xl sm:text-3xl text-ink-950 mt-2 break-words">
            {value}
          </p>
        </div>
        <span
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${tone}`}
        >
          <Icon className="w-5 h-5" aria-hidden="true" />
        </span>
      </div>
      <p className="text-[11px] text-ink-500 mt-3">{detail}</p>
    </article>
  );
}

function SummarySkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 animate-pulse"
    >
      <span className="sr-only">Cargando el resumen…</span>
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          aria-hidden="true"
          className="h-32 rounded-xl border border-sand-200 bg-white"
        />
      ))}
    </div>
  );
}

function RecentSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="rounded-xl border border-sand-200 bg-white shadow-sm divide-y divide-sand-200 animate-pulse"
    >
      <span className="sr-only">Cargando tus últimos envíos…</span>
      {[0, 1, 2, 3, 4].map((item) => (
        <div key={item} aria-hidden="true" className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="h-8 w-40 rounded bg-sand-200" />
          <div className="h-6 w-24 rounded-full bg-sand-200" />
        </div>
      ))}
    </div>
  );
}
