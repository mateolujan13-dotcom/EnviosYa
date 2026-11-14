import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Inbox,
  PackageCheck,
  Truck,
  Warehouse,
} from 'lucide-react';
import clsx from 'clsx';
import type { OpsShipmentsPageDto, OpsSummaryDto } from '@envioya/shared';
import { useAuth } from '../auth/AuthContext';
import { DashboardShell } from '../components/DashboardShell';
import { api } from '../lib/api';
import { formatArs, formatDateTimeAr, formatWeightKg } from '../lib/shipmentMeta';

type FetchStatus = 'loading' | 'error' | 'success';

export function OpsDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const firstName = user?.nombre.split(/\s+/)[0] ?? '';

  const [summaryStatus, setSummaryStatus] = useState<FetchStatus>('loading');
  const [summary, setSummary] = useState<OpsSummaryDto | null>(null);
  const [summaryReloadKey, setSummaryReloadKey] = useState(0);

  const [recentStatus, setRecentStatus] = useState<FetchStatus>('loading');
  const [recent, setRecent] = useState<OpsShipmentsPageDto | null>(null);
  const [recentReloadKey, setRecentReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setSummaryStatus('loading');

    api<OpsSummaryDto>('/ops/summary', { signal: controller.signal })
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

    api<OpsShipmentsPageDto>('/ops/shipments?estado=pendiente&limit=5', {
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        setRecent(data);
        setRecentStatus('success');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof Error && error.name === 'AbortError') return;
        setRecent(null);
        setRecentStatus('error');
      });

    return () => controller.abort();
  }, [recentReloadKey]);

  const incidencias = summary?.con_incidencia ?? 0;

  const kpis = [
    { label: 'Pendientes', value: summary?.pendiente, icon: ClipboardList, tone: 'bg-sand-200 text-ink-700', alert: false },
    { label: 'En tránsito', value: summary?.en_transito, icon: Truck, tone: 'bg-route-100 text-route-600', alert: false },
    { label: 'En sucursal', value: summary?.en_sucursal, icon: Warehouse, tone: 'bg-sand-200 text-ink-700', alert: false },
    { label: 'En reparto', value: summary?.en_reparto, icon: PackageCheck, tone: 'bg-sand-200 text-ink-700', alert: false },
    {
      label: 'Con incidencia',
      value: summary?.con_incidencia,
      icon: AlertTriangle,
      tone: incidencias > 0 ? 'bg-danger-100 text-danger-600' : 'bg-sand-200 text-ink-700',
      alert: incidencias > 0,
    },
    { label: 'Entregados', value: summary?.entregado, icon: CheckCircle2, tone: 'bg-mint-100 text-ink-950', alert: false },
  ];

  return (
    <DashboardShell badge="Torre de Control">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-signal-600 font-semibold mb-1">
            Torre de control
          </p>
          <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-ink-950">
            Hola, {firstName}
          </h1>
          <p className="text-sm text-ink-500 mt-1">
            Cola de despacho, asignación de flota y seguimiento operativo.
          </p>
        </div>
      </section>

      {/* KPI row */}
      {summaryStatus === 'error' ? (
        <section
          role="alert"
          className="rounded-xl border border-sand-300 bg-white p-6 text-center shadow-sm mb-6"
        >
          <p className="text-sm font-semibold text-ink-950">
            No pudimos cargar los indicadores
          </p>
          <p className="text-xs text-ink-500 mt-1">
            Verificá tu conexión e intentá nuevamente.
          </p>
          <button
            type="button"
            onClick={() => setSummaryReloadKey((key) => key + 1)}
            className="mt-4 inline-flex h-10 items-center rounded-lg border border-sand-300 bg-paper px-4 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
          >
            Reintentar
          </button>
        </section>
      ) : (
        <section
          aria-label="Indicadores operativos"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6"
        >
          {kpis.map((kpi) => (
            <article
              key={kpi.label}
              className={clsx(
                'rounded-xl border bg-white p-4 shadow-sm',
                kpi.alert ? 'border-danger-600/50 ring-1 ring-danger-600/30' : 'border-sand-200',
              )}
            >
              <span
                className={clsx(
                  'w-9 h-9 rounded-lg flex items-center justify-center mb-2',
                  kpi.tone,
                )}
              >
                <kpi.icon aria-hidden="true" className="w-[18px] h-[18px]" />
              </span>
              {summaryStatus === 'loading' || kpi.value === undefined ? (
                <span
                  aria-hidden="true"
                  className="block h-7 w-14 rounded bg-sand-200 animate-pulse"
                />
              ) : (
                <p
                  className={clsx(
                    'font-display font-bold text-2xl leading-7',
                    kpi.alert ? 'text-danger-600' : 'text-ink-950',
                  )}
                >
                  {kpi.value}
                </p>
              )}
              <p className="text-[11px] text-ink-500 mt-1">{kpi.label}</p>
            </article>
          ))}
        </section>
      )}

      {/* Acciones */}
      <section aria-labelledby="acciones-heading" className="mb-6">
        <h2
          id="acciones-heading"
          className="font-mono text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-2"
        >
          Acciones
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/ops/envios"
            className="group rounded-xl border border-sand-200 bg-white p-5 shadow-sm transition-colors hover:border-signal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
          >
            <span className="w-10 h-10 rounded-lg bg-ink-950 text-white flex items-center justify-center mb-3">
              <Inbox aria-hidden="true" className="w-5 h-5" />
            </span>
            <span className="flex items-center justify-between gap-3">
              <span className="font-display font-bold text-base text-ink-950">
                Ir a la bandeja de envíos
              </span>
              <ArrowRight
                aria-hidden="true"
                className="w-4 h-4 text-ink-500 transition-transform group-hover:translate-x-0.5"
              />
            </span>
            <span className="block text-xs text-ink-500 mt-1">
              Filtrá por estado y sucursal, buscá por código y ejecutá acciones.
            </span>
          </Link>
          <Link
            to="/"
            className="group rounded-xl border border-sand-200 bg-white p-5 shadow-sm transition-colors hover:border-route-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
          >
            <span className="w-10 h-10 rounded-lg bg-route-100 text-route-600 flex items-center justify-center mb-3">
              <ExternalLink aria-hidden="true" className="w-5 h-5" />
            </span>
            <span className="flex items-center justify-between gap-3">
              <span className="font-display font-bold text-base text-ink-950">
                Ver seguimiento público
              </span>
              <ArrowRight
                aria-hidden="true"
                className="w-4 h-4 text-ink-500 transition-transform group-hover:translate-x-0.5"
              />
            </span>
            <span className="block text-xs text-ink-500 mt-1">
              La vista que usan tus clientes para seguir su envío con el código.
            </span>
          </Link>
        </div>
      </section>

      {/* Pendientes más recientes */}
      <section
        aria-labelledby="pendientes-heading"
        className="rounded-xl border border-sand-200 bg-white shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 px-5 py-4">
          <div>
            <h2
              id="pendientes-heading"
              className="font-display font-bold text-lg text-ink-950"
            >
              Pendientes más recientes
            </h2>
            <p className="text-xs text-ink-500 mt-0.5">
              Los 5 envíos pendientes de despacho más nuevos.
            </p>
          </div>
          <Link
            to="/ops/envios"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-sand-300 bg-paper px-3 text-xs font-semibold text-ink-700 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
          >
            Ver en bandeja
            <ArrowRight aria-hidden="true" className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentStatus === 'loading' && (
          <div role="status" aria-busy="true" className="p-5 space-y-3 animate-pulse">
            <span className="sr-only">Cargando pendientes…</span>
            {[0, 1, 2].map((row) => (
              <div key={row} aria-hidden="true" className="h-9 rounded bg-sand-200" />
            ))}
          </div>
        )}

        {recentStatus === 'error' && (
          <div role="alert" className="p-6 text-center">
            <p className="text-sm font-semibold text-ink-950">
              No pudimos cargar los pendientes
            </p>
            <button
              type="button"
              onClick={() => setRecentReloadKey((key) => key + 1)}
              className="mt-3 inline-flex h-10 items-center rounded-lg border border-sand-300 bg-paper px-4 text-xs font-semibold text-ink-700 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
            >
              Reintentar
            </button>
          </div>
        )}

        {recentStatus === 'success' && recent && recent.items.length === 0 && (
          <p className="p-6 text-sm text-ink-500 text-center">
            No hay envíos pendientes de despacho. Buen trabajo.
          </p>
        )}

        {recentStatus === 'success' && recent && recent.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-sand-200 text-sm">
              <caption className="sr-only">
                Últimos 5 envíos pendientes por fecha de creación
              </caption>
              <thead className="bg-paper">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-500"
                  >
                    Código
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-500"
                  >
                    Ruta
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-500"
                  >
                    Peso
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-500"
                  >
                    Creación
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-500"
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {recent.items.map((item) => (
                  <tr
                    key={item.codigo}
                    className="cursor-pointer transition-colors hover:bg-paper"
                    onClick={() => navigate(`/ops/envios/${item.codigo}`)}
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/ops/envios/${item.codigo}`}
                        className="font-mono text-xs font-semibold uppercase tracking-wider text-route-600 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 rounded"
                      >
                        {item.codigo}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-700 whitespace-nowrap">
                      {item.origenCiudad} → {item.destinoCiudad}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-ink-700 whitespace-nowrap">
                      {formatWeightKg(item.pesoTotalKg)} kg
                    </td>
                    <td className="px-4 py-3 text-ink-700 whitespace-nowrap">
                      {formatDateTimeAr(item.fechaCreacion)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-ink-950 whitespace-nowrap">
                      {formatArs(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
