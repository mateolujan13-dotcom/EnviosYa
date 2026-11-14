import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, PackageSearch, RotateCcw, Search, X } from 'lucide-react';
import clsx from 'clsx';
import type { OpsShipmentsPageDto } from '@envioya/shared';
import { DashboardShell } from '../components/DashboardShell';
import { api } from '../lib/api';
import { SUCURSALES } from '../lib/sucursales';
import { estadoMeta, formatArs, formatDateAr, formatWeightKg } from '../lib/shipmentMeta';

const PAGE_LIMIT = 10;
const SEARCH_DEBOUNCE_MS = 300;

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'pendiente', label: 'Pendiente' },
  { key: 'en_transito', label: 'En tránsito' },
  { key: 'en_sucursal', label: 'En sucursal' },
  { key: 'en_reparto', label: 'En reparto' },
  { key: 'entregado', label: 'Entregados' },
  { key: 'con_incidencia', label: 'Incidencia' },
  { key: 'devuelto', label: 'Devueltos' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

function isFilterKey(value: string | null): value is FilterKey {
  return FILTERS.some((filter) => filter.key === value);
}

function isSucursalId(value: string | null): value is string {
  return SUCURSALES.some((sucursal) => sucursal.id === value);
}

type FetchStatus = 'loading' | 'error' | 'success';

export function OpsShipmentsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const filterParam = searchParams.get('estado');
  const filter: FilterKey = isFilterKey(filterParam) ? filterParam : 'todos';
  const sucursalParam = searchParams.get('sucursal');
  const sucursalId = isSucursalId(sucursalParam) ? sucursalParam : '';
  const q = (searchParams.get('q') ?? '').trim();
  const pageParam = Number(searchParams.get('page') ?? '1');
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? Math.trunc(pageParam) : 1;

  // Debounced mirror of the search box so typing doesn't spam the API.
  const [qInput, setQInput] = useState(q);

  const [status, setStatus] = useState<FetchStatus>('loading');
  const [data, setData] = useState<OpsShipmentsPageDto | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Keep the input in sync when the URL is cleared/changed externally.
  useEffect(() => {
    setQInput(q);
  }, [q]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = qInput.trim();
      if (next === q) return;
      updateParams({ q: next, page: 1 });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [qInput]);

  useEffect(() => {
    const controller = new AbortController();

    setStatus('loading');

    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_LIMIT) });
    if (filter !== 'todos') params.set('estado', filter);
    if (sucursalId) params.set('sucursalId', sucursalId);
    if (q) params.set('q', q);

    api<OpsShipmentsPageDto>(`/ops/shipments?${params.toString()}`, {
      signal: controller.signal,
    })
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
  }, [filter, sucursalId, q, page, reloadKey]);

  const updateParams = (next: {
    estado?: FilterKey;
    sucursal?: string;
    q?: string;
    page?: number;
  }) => {
    const params = new URLSearchParams();
    const nextFilter = next.estado ?? filter;
    const nextSucursal = next.sucursal ?? sucursalId;
    const nextQ = next.q ?? q;
    const nextPage = next.page ?? page;

    if (nextFilter !== 'todos') params.set('estado', nextFilter);
    if (nextSucursal) params.set('sucursal', nextSucursal);
    if (nextQ) params.set('q', nextQ);
    if (nextPage > 1) params.set('page', String(nextPage));

    setSearchParams(params, { replace: true });
  };

  const handleClear = (event?: FormEvent) => {
    event?.preventDefault();
    setQInput('');
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const hasActiveFilters = filter !== 'todos' || sucursalId !== '' || q !== '';
  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1;
  const to = Math.min(page * PAGE_LIMIT, total);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  return (
    <DashboardShell badge="Torre de Control">
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-signal-600 font-semibold mb-1">
            Bandeja operativa
          </p>
          <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-ink-950">
            Envíos
          </h1>
        </div>
        <Link
          to="/ops"
          className="inline-flex h-10 items-center gap-2 self-start sm:self-auto rounded-lg border border-sand-300 bg-white px-4 text-xs font-semibold text-ink-700 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
        >
          Volver al panel
        </Link>
      </section>

      {/* Filter chips */}
      <div
        role="group"
        aria-label="Filtrar envíos por estado"
        className="flex flex-wrap gap-2 mb-3"
      >
        {FILTERS.map((item) => {
          const isActive = item.key === filter;

          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => updateParams({ estado: item.key, page: 1 })}
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

      {/* Sucursal + search + limpiar */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div className="w-full sm:w-auto sm:min-w-[240px]">
          <label
            htmlFor="sucursal-filter"
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink-500"
          >
            Sucursal
          </label>
          <select
            id="sucursal-filter"
            value={sucursalId}
            onChange={(event) => updateParams({ sucursal: event.target.value, page: 1 })}
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

        <div className="relative w-full sm:flex-1 sm:min-w-[220px]">
          <label
            htmlFor="codigo-search"
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink-500"
          >
            Buscar código
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-[34px] h-4 w-4 text-ink-500"
          />
          <input
            id="codigo-search"
            type="search"
            value={qInput}
            onChange={(event) => setQInput(event.target.value)}
            placeholder="Ej: EY-4F8A1C"
            autoComplete="off"
            spellCheck={false}
            className="h-11 w-full rounded-lg border border-sand-300 bg-white pl-9 pr-3 text-sm text-ink-950 placeholder:text-ink-500/70 focus:outline-none focus:ring-2 focus:ring-route-600/25 focus:border-route-600"
          />
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => handleClear()}
            className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-ink-500 transition-colors hover:bg-sand-200 hover:text-ink-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
          >
            <X aria-hidden="true" className="h-4 w-4" />
            Limpiar
          </button>
        )}
      </div>

      {status === 'loading' && <TableSkeleton />}

      {status === 'error' && (
        <section
          role="alert"
          className="rounded-xl border border-sand-300 bg-white p-8 text-center shadow-sm"
        >
          <p className="text-sm font-semibold text-ink-950">
            No pudimos cargar los envíos
          </p>
          <p className="text-xs text-ink-500 mt-1">
            Verificá tu conexión e intentá nuevamente.
          </p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-sand-300 bg-paper px-4 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Reintentar
          </button>
        </section>
      )}

      {status === 'success' && data && data.items.length === 0 && (
        <section className="rounded-xl border border-sand-200 bg-white p-8 sm:p-10 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-sand-200/70 text-ink-700 flex items-center justify-center mx-auto mb-4">
            <PackageSearch aria-hidden="true" className="w-7 h-7" />
          </div>
          <h2 className="font-display font-bold text-xl text-ink-950">
            No hay envíos con ese filtro
          </h2>
          <p className="text-sm text-ink-500 max-w-md mx-auto mt-1.5">
            {hasActiveFilters
              ? 'Probá ajustando el estado, la sucursal o el código de búsqueda.'
              : 'Todavía no hay envíos registrados en la operación.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => handleClear()}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg border border-sand-300 bg-paper px-5 text-sm font-semibold text-ink-700 transition-colors hover:bg-sand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600"
            >
              Limpiar filtros
            </button>
          )}
        </section>
      )}

      {status === 'success' && data && data.items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-sand-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-sand-200 text-sm">
              <caption className="sr-only">
                Bandeja de envíos{filter !== 'todos' ? ` (filtro: ${filter})` : ''}
              </caption>
              <thead className="bg-paper">
                <tr>
                  <Th>Código</Th>
                  <Th>Cliente</Th>
                  <Th>Ruta</Th>
                  <Th className="text-right">Bultos</Th>
                  <Th className="text-right">Peso</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Fecha</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200">
                {data.items.map((item) => {
                  const meta = estadoMeta(item.estado);

                  return (
                    <tr
                      key={item.codigo}
                      className="cursor-pointer transition-colors hover:bg-paper"
                      onClick={() => navigate(`/ops/envios/${item.codigo}`)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          to={`/ops/envios/${item.codigo}`}
                          className="font-mono text-xs font-semibold uppercase tracking-wider text-route-600 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-route-600 rounded"
                        >
                          {item.codigo}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-medium text-ink-900">
                        {item.cliente}
                      </td>
                      <td className="px-4 py-3 text-ink-700 whitespace-nowrap">
                        {item.origenCiudad} → {item.destinoCiudad}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-ink-700">
                        {item.totalPaquetes}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-ink-700 whitespace-nowrap">
                        {formatWeightKg(item.pesoTotalKg)} kg
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-ink-950 whitespace-nowrap">
                        {formatArs(item.total)}
                      </td>
                      <td className="px-4 py-3 text-ink-700 whitespace-nowrap">
                        {formatDateAr(item.fechaCreacion)}
                      </td>
                      <td className="px-4 py-3">
                        {item.cancelado ? (
                          <span className="inline-flex items-center rounded-full bg-danger-100 px-2.5 py-1 text-[11px] font-semibold text-danger-600">
                            Cancelado
                          </span>
                        ) : (
                          <span
                            className={clsx(
                              'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap',
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
              {from}–{to} de {total} {total === 1 ? 'envío' : 'envíos'}
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
                onClick={() => updateParams({ page: Math.min(totalPages, page + 1) })}
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
      <span className="sr-only">Cargando la bandeja de envíos…</span>
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div
          key={item}
          aria-hidden="true"
          className="flex items-center justify-between gap-4 border-b border-sand-200 px-4 py-4 last:border-b-0"
        >
          <div className="h-5 w-28 rounded bg-sand-200" />
          <div className="hidden h-5 w-40 rounded bg-sand-200 sm:block" />
          <div className="hidden h-5 w-32 rounded bg-sand-200 md:block" />
          <div className="h-6 w-20 rounded-full bg-sand-200" />
        </div>
      ))}
    </div>
  );
}
