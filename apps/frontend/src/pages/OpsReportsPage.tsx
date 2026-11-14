import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  Loader2,
  Package,
  PackageCheck,
  Percent,
  Receipt,
  RotateCcw,
  Wallet,
} from 'lucide-react';
import clsx from 'clsx';
import type {
  ReporteEstadoDto,
  ReporteSucursalDto,
  ReportsSummaryDto,
  TiemposPromedioDto,
  TopRepartidorDto,
} from '@envioya/shared';
import { DashboardShell } from '../components/DashboardShell';
import { api } from '../lib/api';
import { formatWeightKg, estadoMeta } from '../lib/shipmentMeta';
import { SUCURSALES } from '../lib/sucursales';

interface BlockDataMap {
  resumen: ReportsSummaryDto;
  porSucursal: ReporteSucursalDto[];
  tiempos: TiemposPromedioDto;
  topRepartidores: TopRepartidorDto[];
  porEstado: ReporteEstadoDto[];
}

type BlockKey = keyof BlockDataMap;
type BlockStatus = 'loading' | 'error' | 'success';

interface BlockState<K extends BlockKey> {
  status: BlockStatus;
  data: BlockDataMap[K] | null;
}

type ReportsBlocks = { [K in BlockKey]: BlockState<K> };

const REPORT_PATHS: Record<BlockKey, string> = {
  resumen: '/ops/reports/resumen',
  porSucursal: '/ops/reports/por-sucursal',
  tiempos: '/ops/reports/tiempos-promedio',
  topRepartidores: '/ops/reports/top-repartidores',
  porEstado: '/ops/reports/por-estado',
};

const BLOCK_KEYS = Object.keys(REPORT_PATHS) as BlockKey[];

interface AppliedFilters {
  from: string;
  to: string;
  sucursalId: string;
}

const EMPTY_FILTERS: AppliedFilters = { from: '', to: '', sucursalId: '' };

const formatArs0 = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

function formatHours(value: number): string {
  return `${value.toLocaleString('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} h`;
}

function formatPercent1(value: number): string {
  return `${value.toLocaleString('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`;
}

function formatInteger(value: number): string {
  return value.toLocaleString('es-AR', { maximumFractionDigits: 0 });
}

function buildQuery(filters: AppliedFilters): string {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.sucursalId) params.set('sucursalId', filters.sucursalId);
  const query = params.toString();
  return query ? `?${query}` : '';
}

function fetchBlock<K extends BlockKey>(
  key: K,
  query: string,
  signal?: AbortSignal,
): Promise<BlockDataMap[K]> {
  return api(`${REPORT_PATHS[key]}${query}`, { signal }) as Promise<BlockDataMap[K]>;
}

function loadingBlocks(): ReportsBlocks {
  return {
    resumen: { status: 'loading', data: null },
    porSucursal: { status: 'loading', data: null },
    tiempos: { status: 'loading', data: null },
    topRepartidores: { status: 'loading', data: null },
    porEstado: { status: 'loading', data: null },
  };
}

/** Colores del donut por estado (tokens del design system, valores hex para SVG). */
const ESTADO_COLORS: Record<string, string> = {
  pendiente: '#D8D0C0', // sand-300
  en_transito: '#1D4ED8', // route-600
  en_sucursal: '#1E2A3B', // ink-700
  en_reparto: '#F59E0B', // warning-500
  entregado: '#B9F27C', // mint-300
  con_incidencia: '#B42318', // danger-600
  devuelto: '#FEE4E2', // danger-100 (borde danger-600 en la leyenda)
  cancelado: '#4B5563', // ink-500 (gris)
};

const ESTADO_BORDERED = new Set(['devuelto']);

function estadoColor(estado: string): string {
  return ESTADO_COLORS[estado] ?? '#4B5563';
}

export function OpsReportsPage() {
  const [draft, setDraft] = useState<AppliedFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<AppliedFilters>(EMPTY_FILTERS);
  const [dateError, setDateError] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<ReportsBlocks>(loadingBlocks);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const query = buildQuery(applied);

    setBlocks(loadingBlocks());

    Promise.allSettled(
      BLOCK_KEYS.map((key) => fetchBlock(key, query, controller.signal)),
    ).then((results) => {
      if (controller.signal.aborted) return;

      setBlocks((previous) => {
        const next = { ...previous } as Record<BlockKey, unknown>;
        BLOCK_KEYS.forEach((key, index) => {
          const result = results[index];
          next[key] =
            result.status === 'fulfilled'
              ? { status: 'success', data: result.value }
              : { status: 'error', data: null };
        });
        return next as ReportsBlocks;
      });
    });

    return () => controller.abort();
  }, [applied]);

  const retryBlock = (key: BlockKey) => {
    const query = buildQuery(applied);

    setBlocks(
      (previous) =>
        ({ ...previous, [key]: { status: 'loading', data: null } }) as ReportsBlocks,
    );

    fetchBlock(key, query)
      .then((data) => {
        setBlocks(
          (previous) =>
            ({ ...previous, [key]: { status: 'success', data } }) as ReportsBlocks,
        );
      })
      .catch(() => {
        setBlocks(
          (previous) =>
            ({ ...previous, [key]: { status: 'error', data: null } }) as ReportsBlocks,
        );
      });
  };

  const handleApply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (draft.from && draft.to && draft.from > draft.to) {
      setDateError('La fecha «Desde» no puede ser posterior a «Hasta».');
      return;
    }

    setDateError(null);
    setApplied(draft);
  };

  const handleClear = () => {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setDateError(null);
  };

  const handleExportCsv = async () => {
    setExporting(true);
    setExportError(null);

    try {
      const response = await fetch(`/api/ops/reports/envios.csv${buildQuery(applied)}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        setExportError(
          response.status === 403
            ? 'No tenés permisos para exportar el CSV.'
            : 'No se pudo exportar el CSV. Intentá nuevamente.',
        );
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const match = /filename\*?=(?:UTF-8'')?\s*"?([^";]+)"?/i.exec(disposition);
      const filename = match?.[1] ? decodeURIComponent(match[1].trim()) : 'envios.csv';

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('No se pudo exportar el CSV. Intentá nuevamente.');
    } finally {
      setExporting(false);
    }
  };

  const hasActiveFilters =
    draft.from !== '' ||
    draft.to !== '' ||
    draft.sucursalId !== '' ||
    applied.from !== '' ||
    applied.to !== '' ||
    applied.sucursalId !== '';

  const { resumen, porSucursal, tiempos, topRepartidores, porEstado } = blocks;

  return (
    <DashboardShell badge="Torre de Control">
      <Link
        to="/ops"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 transition-colors hover:text-ink-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 rounded mb-4"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Volver a Torre de Control
      </Link>

      {/* Page header + export action */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-signal-600 font-semibold mb-1">
            Torre de control
          </p>
          <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-ink-950">
            Reportes operativos
          </h1>
          <p className="text-sm text-ink-500 mt-1">
            Indicadores de volumen, entrega y distribución por estado del período.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleExportCsv()}
          disabled={exporting}
          className="inline-flex h-11 items-center gap-2 self-start sm:self-auto rounded-lg border border-sand-300 bg-white px-4 text-xs font-semibold text-ink-950 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {exporting ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <Download aria-hidden="true" className="h-4 w-4" />
          )}
          {exporting ? 'Exportando…' : 'Exportar CSV'}
        </button>
      </section>

      {exportError && (
        <p role="alert" className="mb-4 text-xs font-medium text-danger-600">
          {exportError}
        </p>
      )}

      {/* Filter bar */}
      <form
        onSubmit={handleApply}
        aria-label="Filtros de reportes"
        className="rounded-xl border border-sand-200 bg-white p-4 shadow-sm mb-2 flex flex-wrap items-end gap-3"
      >        <div>
          <label
            htmlFor="reports-from"
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink-500"
          >
            Desde
          </label>
          <input
            id="reports-from"
            type="date"
            value={draft.from}
            max={draft.to || undefined}
            onChange={(event) => setDraft((prev) => ({ ...prev, from: event.target.value }))}
            className="h-11 rounded-lg border border-sand-300 bg-white px-3 text-sm text-ink-950 focus:outline-none focus:ring-2 focus:ring-route-600/25 focus:border-route-600"
          />
        </div>
        <div>
          <label
            htmlFor="reports-to"
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink-500"
          >
            Hasta
          </label>
          <input
            id="reports-to"
            type="date"
            value={draft.to}
            min={draft.from || undefined}
            onChange={(event) => setDraft((prev) => ({ ...prev, to: event.target.value }))}
            className="h-11 rounded-lg border border-sand-300 bg-white px-3 text-sm text-ink-950 focus:outline-none focus:ring-2 focus:ring-route-600/25 focus:border-route-600"
          />
        </div>
        <div className="min-w-[220px] flex-1 sm:flex-none">
          <label
            htmlFor="reports-sucursal"
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink-500"
          >
            Sucursal
          </label>
          <select
            id="reports-sucursal"
            value={draft.sucursalId}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, sucursalId: event.target.value }))
            }
            className="h-11 w-full rounded-lg border border-sand-300 bg-white px-3 text-sm text-ink-950 focus:outline-none focus:ring-2 focus:ring-route-600/25 focus:border-route-600"
          >
            <option value="">Todas las sucursales</option>
            {SUCURSALES.map((sucursal) => (
              <option key={sucursal.id} value={sucursal.id}>
                {sucursal.nombre} ({sucursal.id})
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="inline-flex h-11 items-center rounded-lg bg-ink-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-ink-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
        >
          Aplicar
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex h-11 items-center rounded-lg px-3 text-xs font-semibold text-ink-500 transition-colors hover:bg-sand-200 hover:text-ink-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
          >
            Limpiar
          </button>
        )}
      </form>
      {dateError ? (
        <p role="alert" className="mb-5 mt-2 text-xs font-medium text-danger-600">
          {dateError}
        </p>
      ) : (
        <div className="mb-3" />
      )}

      {/* KPI strip */}
      {resumen.status === 'error' ? (
        <section
          role="alert"
          className="rounded-xl border border-sand-300 bg-white p-6 text-center shadow-sm mb-5"
        >
          <p className="text-sm font-semibold text-ink-950">
            No pudimos cargar los indicadores
          </p>
          <p className="text-xs text-ink-500 mt-1">
            Verificá tu conexión e intentá nuevamente.
          </p>
          <button
            type="button"
            onClick={() => retryBlock('resumen')}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-sand-300 bg-paper px-4 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Reintentar
          </button>
        </section>
      ) : (
        <section
          aria-label="Indicadores del período"
          className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-5"
        >
          <KpiTile
            label="Envíos totales"
            icon={Package}
            state={resumen.status}
            value={resumen.data ? formatInteger(resumen.data.totalEnvios) : undefined}
          />
          <KpiTile
            label="Entregados"
            icon={PackageCheck}
            state={resumen.status}
            value={resumen.data ? formatInteger(resumen.data.entregados) : undefined}
          />
          <KpiTile
            label="Tasa de entrega"
            icon={Percent}
            state={resumen.status}
            value={resumen.data ? formatPercent1(resumen.data.tasaEntrega) : undefined}
          />
          <KpiTile
            label="Gasto total"
            icon={Wallet}
            state={resumen.status}
            value={resumen.data ? formatArs0.format(resumen.data.gastoTotal) : undefined}
          />
          <KpiTile
            label="Ticket promedio"
            icon={Receipt}
            state={resumen.status}
            value={resumen.data ? formatArs0.format(resumen.data.ticketPromedio) : undefined}
          />
          <KpiTile
            label="Incidencias abiertas"
            icon={AlertTriangle}
            state={resumen.status}
            value={resumen.data ? formatInteger(resumen.data.conIncidencia) : undefined}
            alert={(resumen.data?.conIncidencia ?? 0) > 0}
          />
        </section>
      )}

      {/* Donut + barras por sucursal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
        <SectionCard
          id="estado-heading"
          title="Distribución por estado"
          subtitle="Volumen consolidado por estado en el período"
          className="lg:col-span-5"
        >
          {porEstado.status === 'loading' && <BlockSkeleton rows={5} />}
          {porEstado.status === 'error' && (
            <BlockError
              title="No pudimos cargar la distribución por estado"
              onRetry={() => retryBlock('porEstado')}
            />
          )}
          {porEstado.status === 'success' && porEstado.data && (
            <EstadoDonut entries={porEstado.data} />
          )}
        </SectionCard>

        <SectionCard
          id="sucursal-heading"
          title="Envíos por sucursal"
          subtitle="Volumen por sucursal de destino"
          className="lg:col-span-7"
        >
          {porSucursal.status === 'loading' && <BlockSkeleton rows={5} />}
          {porSucursal.status === 'error' && (
            <BlockError
              title="No pudimos cargar los envíos por sucursal"
              onRetry={() => retryBlock('porSucursal')}
            />
          )}
          {porSucursal.status === 'success' && porSucursal.data && (
            <SucursalBars items={porSucursal.data} />
          )}
        </SectionCard>
      </div>

      {/* Tiempos promedio + top repartidores */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pb-6">
        <SectionCard
          id="tiempos-heading"
          title="Tiempo de entrega promedio"
          subtitle="Horas creación → entrega, sobre envíos entregados"
          className="lg:col-span-5"
        >
          {tiempos.status === 'loading' && <BlockSkeleton rows={5} />}
          {tiempos.status === 'error' && (
            <BlockError
              title="No pudimos cargar los tiempos promedio"
              onRetry={() => retryBlock('tiempos')}
            />
          )}
          {tiempos.status === 'success' && tiempos.data && (
            <TiemposTable tiempos={tiempos.data} />
          )}
        </SectionCard>

        <SectionCard
          id="top-heading"
          title="Top repartidores"
          subtitle="Los 5 repartidores con más entregas en el período"
          className="lg:col-span-7"
        >
          {topRepartidores.status === 'loading' && <BlockSkeleton rows={5} />}
          {topRepartidores.status === 'error' && (
            <BlockError
              title="No pudimos cargar el top de repartidores"
              onRetry={() => retryBlock('topRepartidores')}
            />
          )}
          {topRepartidores.status === 'success' && topRepartidores.data && (
            <TopRepartidoresTable items={topRepartidores.data} />
          )}
        </SectionCard>
      </div>
    </DashboardShell>
  );
}

function SectionCard({
  id,
  title,
  subtitle,
  className,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={clsx(
        'rounded-xl border border-sand-200 bg-white p-5 shadow-sm',
        className,
      )}
    >
      <div className="mb-4 border-b border-sand-200 pb-3">
        <h2 id={id} className="font-display font-bold text-lg text-ink-950">
          {title}
        </h2>
        <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function KpiTile({
  label,
  icon: Icon,
  state,
  value,
  alert = false,
}: {
  label: string;
  icon: typeof Package;
  state: BlockStatus;
  value: string | undefined;
  alert?: boolean;
}) {
  return (
    <article
      className={clsx(
        'rounded-xl border bg-white p-4 shadow-sm',
        alert ? 'border-danger-600/50 ring-1 ring-danger-600/30' : 'border-sand-200',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
          {label}
        </span>
        <Icon
          aria-hidden="true"
          className={clsx('h-[18px] w-[18px]', alert ? 'text-danger-600' : 'text-ink-700')}
        />
      </div>
      {state === 'loading' || value === undefined ? (
        <span
          aria-hidden="true"
          className="mt-2 block h-8 w-16 rounded bg-sand-200 animate-pulse"
        />
      ) : (
        <p
          className={clsx(
            'mt-2 font-display font-bold text-xl sm:text-2xl leading-7 tabular-nums',
            alert ? 'text-danger-600' : 'text-ink-950',
          )}
        >
          {value}
        </p>
      )}
    </article>
  );
}

function BlockSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" className="space-y-3 animate-pulse">
      <span className="sr-only">Cargando…</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} aria-hidden="true" className="h-9 rounded bg-sand-200" />
      ))}
    </div>
  );
}

function BlockError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-sand-300 bg-paper p-6 text-center">
      <p className="text-sm font-semibold text-ink-950">{title}</p>
      <p className="text-xs text-ink-500 mt-1">
        Verificá tu conexión e intentá nuevamente.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-sand-300 bg-white px-4 text-xs font-semibold text-ink-700 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
      >
        <RotateCcw aria-hidden="true" className="h-4 w-4" />
        Reintentar
      </button>
    </div>
  );
}

function EstadoDonut({ entries }: { entries: ReporteEstadoDto[] }) {
  const RADIUS = 14;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const slices = entries.filter((entry) => entry.cantidad > 0);
  const total = slices.reduce((acc, entry) => acc + entry.cantidad, 0);

  let offset = 0;
  const arcs = slices.map((slice) => {
    const fraction = total > 0 ? slice.cantidad / total : 0;
    const length = fraction * CIRCUMFERENCE;
    const arc = { slice, fraction, length, dashoffset: -offset };
    offset += length;
    return arc;
  });

  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-ink-500">
        Sin datos para el período
      </p>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative h-36 w-36 shrink-0">
        <svg
          viewBox="0 0 36 36"
          className="h-36 w-36"
          role="group"
          aria-label={`Distribución por estado: ${formatInteger(total)} envíos`}
        >
          <g transform="rotate(-90 18 18)">
            <circle
              cx="18"
              cy="18"
              r={RADIUS}
              fill="transparent"
              stroke="#E7DFD1"
              strokeWidth="4.5"
            />
            {arcs.map(({ slice, length, dashoffset, fraction }) => {
              const meta = estadoMeta(slice.estado);

              return (
                <circle
                  key={slice.estado}
                  cx="18"
                  cy="18"
                  r={RADIUS}
                  fill="transparent"
                  stroke={estadoColor(slice.estado)}
                  strokeWidth="4.5"
                  strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                  strokeDashoffset={dashoffset}
                  role="img"
                  aria-label={`${meta.label}: ${formatInteger(slice.cantidad)} envíos (${formatPercent1(fraction * 100)})`}
                />
              );
            })}
          </g>
        </svg>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
        >
          <span className="font-display font-bold text-2xl leading-none text-ink-950">
            {formatInteger(total)}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
            Total
          </span>
        </div>
      </div>

      <ul className="flex-1 w-full space-y-2 text-sm">
        {arcs.map(({ slice, fraction }) => {
          const meta = estadoMeta(slice.estado);
          const bordered = ESTADO_BORDERED.has(slice.estado);

          return (
            <li key={slice.estado} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: estadoColor(slice.estado),
                    border: bordered ? '1px solid #B42318' : '1px solid #D8D0C0',
                  }}
                />
                <span className="truncate font-medium text-ink-950">{meta.label}</span>
              </span>
              <span className="tabular-nums text-ink-700 whitespace-nowrap">
                {formatInteger(slice.cantidad)}{' '}
                <span className="text-ink-500">({formatPercent1(fraction * 100)})</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SucursalBars({ items }: { items: ReporteSucursalDto[] }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-500">Sin datos para el período</p>;
  }

  const top = items.slice(0, 5);
  const rest = items.slice(5);
  const rows: ReporteSucursalDto[] =
    rest.length > 0
      ? [
          ...top,
          {
            sucursalId: 'otros',
            nombre: 'Otros',
            cantidad: rest.reduce((acc, item) => acc + item.cantidad, 0),
            entregados: rest.reduce((acc, item) => acc + item.entregados, 0),
            totalARS: rest.reduce((acc, item) => acc + item.totalARS, 0),
          },
        ]
      : top;

  const maxCantidad = Math.max(...rows.map((row) => row.cantidad), 1);

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.sucursalId}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium text-ink-950">{row.nombre}</span>
            <span className="shrink-0 tabular-nums text-xs text-ink-700 whitespace-nowrap">
              <strong className="text-ink-950">{formatInteger(row.cantidad)}</strong> envíos ·{' '}
              {formatInteger(row.entregados)} entregados
            </span>
          </div>
          <div
            className="mt-1 h-2.5 w-full overflow-hidden rounded-full border border-sand-200 bg-paper"
            role="img"
            aria-label={`${row.nombre}: ${formatInteger(row.cantidad)} envíos`}
          >
            <div
              className="h-full rounded-full bg-route-600"
              style={{ width: `${(row.cantidad / maxCantidad) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function TiemposTable({ tiempos }: { tiempos: TiemposPromedioDto }) {
  return (
    <>
      <p className="mb-3 text-xs font-semibold text-ink-700">
        Promedio global: {formatHours(tiempos.promedioHoras)}
      </p>
      {tiempos.porSucursal.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-500">Sin datos para el período</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-sand-200 text-sm">
            <caption className="sr-only">
              Tiempo promedio de entrega por sucursal de destino
            </caption>
            <thead className="bg-paper">
              <tr>
                <Th>Sucursal</Th>
                <Th className="text-right">Entregas</Th>
                <Th className="text-right">Promedio</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {tiempos.porSucursal.map((row) => (
                <tr key={row.sucursalId} className="transition-colors hover:bg-paper">
                  <td className="px-4 py-3 font-medium text-ink-950">{row.nombre}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-700">
                    {formatInteger(row.entregados)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-ink-950 whitespace-nowrap">
                    {formatHours(row.promedioHoras)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function TopRepartidoresTable({ items }: { items: TopRepartidorDto[] }) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-ink-500">Sin entregas en el período</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-sand-200 text-sm">
        <caption className="sr-only">
          Top 5 repartidores por entregas en el período
        </caption>
        <thead className="bg-paper">
          <tr>
            <Th>#</Th>
            <Th>Nombre</Th>
            <Th className="text-right">Entregas</Th>
            <Th className="text-right">Peso (kg)</Th>
            <Th className="text-right">Total (ARS)</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sand-200">
          {items.map((repartidor, index) => (
            <tr key={repartidor.repartidorId} className="transition-colors hover:bg-paper">
              <td className="px-4 py-3 font-mono text-xs text-ink-500">{index + 1}</td>
              <td className="px-4 py-3 font-medium text-ink-950">{repartidor.nombre}</td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-ink-950">
                {formatInteger(repartidor.entregas)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-ink-700 whitespace-nowrap">
                {formatWeightKg(repartidor.pesoTotalKg)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-ink-950 whitespace-nowrap">
                {formatArs0.format(repartidor.totalARS)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={clsx(
        'px-4 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-500',
        className,
      )}
    >
      {children}
    </th>
  );
}
