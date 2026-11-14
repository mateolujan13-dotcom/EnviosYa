import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Package,
  Plus,
} from 'lucide-react';
import clsx from 'clsx';
import type { ShipmentsPageDto } from '@envioya/shared';
import { DashboardShell } from '../components/DashboardShell';
import { api } from '../lib/api';
import { estadoMeta, formatArs, formatDateAr } from '../lib/shipmentMeta';

const PAGE_LIMIT = 10;

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'pendiente', label: 'Pendiente' },
  { key: 'en_transito', label: 'En tránsito' },
  { key: 'en_sucursal', label: 'En sucursal' },
  { key: 'en_reparto', label: 'En reparto' },
  { key: 'entregado', label: 'Entregados' },
  { key: 'cancelados', label: 'Cancelados' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

function isFilterKey(value: string | null): value is FilterKey {
  return FILTERS.some((filter) => filter.key === value);
}

type FetchStatus = 'loading' | 'error' | 'success';

export function ShipmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filterParam = searchParams.get('filtro');
  const filter: FilterKey = isFilterKey(filterParam) ? filterParam : 'todos';
  const pageParam = Number(searchParams.get('page') ?? '1');
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.trunc(pageParam) : 1;

  const [status, setStatus] = useState<FetchStatus>('loading');
  const [data, setData] = useState<ShipmentsPageDto | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setStatus('loading');

    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_LIMIT) });
    if (filter === 'cancelados') {
      params.set('cancelados', 'true');
    } else if (filter !== 'todos') {
      params.set('estado', filter);
    }

    api<ShipmentsPageDto>(`/shipments?${params.toString()}`, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setStatus('success');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof Error && error.name === 'AbortError') return;
        setData(null);
        setStatus('error');
      });

    return () => controller.abort();
  }, [filter, page, reloadKey]);

  const updateParams = (next: { filtro?: FilterKey; page?: number }) => {
    const params = new URLSearchParams();
    const nextFilter = next.filtro ?? filter;
    const nextPage = next.page ?? page;

    if (nextFilter !== 'todos') params.set('filtro', nextFilter);
    if (nextPage > 1) params.set('page', String(nextPage));

    setSearchParams(params, { replace: true });
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_LIMIT)) : 1;

  return (
    <DashboardShell badge="Portal del cliente">
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-signal-600 font-semibold mb-1">
            Historial
          </p>
          <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-ink-950">
            Mis envíos
          </h1>
        </div>
        <Link
          to="/app/nuevo"
          className="inline-flex h-11 items-center gap-2 self-start sm:self-auto rounded-lg bg-ink-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
        >
          <Plus aria-hidden="true" className="w-4 h-4" />
          Nuevo envío
        </Link>
      </section>

      {/* Filter chips */}
      <div
        role="group"
        aria-label="Filtrar envíos por estado"
        className="flex flex-wrap gap-2 mb-5"
      >
        {FILTERS.map((item) => {
          const isActive = item.key === filter;

          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => updateParams({ filtro: item.key, page: 1 })}
              className={clsx(
                'inline-flex h-9 items-center rounded-full border px-4 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600',
                isActive
                  ? 'border-ink-950 bg-ink-950 text-white'
                  : 'border-sand-300 bg-white text-ink-700 hover:border-ink-950 hover:text-ink-950',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {status === 'loading' && <TableSkeleton />}

      {status === 'error' && (
        <section
          role="alert"
          className="rounded-xl border border-sand-300 bg-white p-8 text-center shadow-sm"
        >
          <p className="text-sm font-semibold text-ink-950">
            No pudimos cargar tus envíos
          </p>
          <p className="text-xs text-ink-500 mt-1">
            Verificá tu conexión e intentá nuevamente.
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-sand-300 bg-paper px-4 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
          >
            Reintentar
          </button>
        </section>
      )}

      {status === 'success' && data && data.items.length === 0 && (
        <section className="rounded-xl border border-sand-200 bg-white p-8 sm:p-10 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-sand-200/70 text-ink-700 flex items-center justify-center mx-auto mb-4">
            <Package className="w-7 h-7" aria-hidden="true" />
          </div>
          <h2 className="font-display font-bold text-xl text-ink-950">
            Todavía no tenés envíos
          </h2>
          <p className="text-sm text-ink-500 max-w-md mx-auto mt-1.5">
            {filter === 'todos'
              ? 'Cuando crees tu primer envío vas a verlo acá con su estado y su costo.'
              : 'No hay envíos que coincidan con este filtro.'}
          </p>
          <Link
            to="/app/nuevo"
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-ink-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
          >
            <Plus aria-hidden="true" className="w-4 h-4" />
            Cotizá tu primer envío
          </Link>
        </section>
      )}

      {status === 'success' && data && data.items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-sand-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-sand-200 text-sm">
              <caption className="sr-only">
                Listado paginado de tus envíos{filter !== 'todos' ? ` (filtro: ${filter})` : ''}
              </caption>
              <thead className="bg-paper">
                <tr>
                  <Th>Código</Th>
                  <Th>Destino</Th>
                  <Th>Creación</Th>
                  <Th className="text-right">Bultos</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {data.items.map((item) => {
                  const meta = estadoMeta(item.estado);

                  return (
                    <tr
                      key={item.codigo}
                      className="transition-colors hover:bg-paper"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/app/envios/${item.codigo}`}
                          className="font-mono text-xs font-semibold uppercase tracking-wider text-route-600 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 rounded"
                        >
                          {item.codigo}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-medium text-ink-900">
                        {item.destinoCiudad}
                      </td>
                      <td className="px-4 py-3 text-ink-700">
                        {formatDateAr(item.fechaCreacion)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-ink-700">
                        {item.totalPaquetes}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-ink-950">
                        {formatArs(item.total)}
                      </td>
                      <td className="px-4 py-3">
                        {item.cancelado ? (
                          <span className="inline-flex items-center rounded-full bg-danger-100 px-2.5 py-1 text-[11px] font-semibold text-danger-600">
                            Cancelado
                          </span>
                        ) : (
                          <span
                            className={clsx(
                              'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold',
                              meta.chipClass,
                            )}
                          >
                            {meta.label}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <nav
            aria-label="Paginación de envíos"
            className="mt-4 flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-xs text-ink-500" aria-live="polite">
              {data.total} {data.total === 1 ? 'envío' : 'envíos'} · página {data.page} de{' '}
              {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateParams({ page: Math.max(1, page - 1) })}
                disabled={page <= 1}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-sand-300 bg-white px-3 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                Anterior
              </button>
              <button
                type="button"
                onClick={() => updateParams({ page: page + 1 })}
                disabled={page >= totalPages}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-sand-300 bg-white px-3 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Siguiente
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </nav>
        </>
      )}
    </DashboardShell>
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

function TableSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="overflow-hidden rounded-xl border border-sand-200 bg-white shadow-sm animate-pulse"
    >
      <span className="sr-only">Cargando tus envíos…</span>
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div
          key={item}
          aria-hidden="true"
          className="flex items-center justify-between gap-4 border-b border-sand-200 px-4 py-4 last:border-b-0"
        >
          <div className="h-5 w-28 rounded bg-sand-200" />
          <div className="hidden h-5 w-32 rounded bg-sand-200 sm:block" />
          <div className="hidden h-5 w-24 rounded bg-sand-200 md:block" />
          <div className="h-6 w-20 rounded-full bg-sand-200" />
        </div>
      ))}
    </div>
  );
}
