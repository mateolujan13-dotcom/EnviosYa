/**
 * Shared estado → label/chip mapping plus date and number formatters for the
 * client shipment views (dashboard, list, detail). TrackingPage keeps its own
 * copy on purpose; both must stay visually consistent.
 */

const ART_TIMEZONE = 'America/Argentina/Buenos_Aires';

export const ESTADO_META: Record<string, { label: string; chipClass: string }> = {
  pendiente: {
    label: 'Pendiente',
    chipClass: 'bg-route-100 text-route-600',
  },
  en_transito: {
    label: 'En tránsito',
    chipClass: 'bg-route-100 text-route-600',
  },
  en_sucursal: {
    label: 'En sucursal',
    chipClass: 'bg-route-100 text-route-600',
  },
  en_reparto: {
    label: 'En reparto',
    chipClass: 'bg-route-100 text-route-600',
  },
  entregado: {
    label: 'Entregado',
    chipClass: 'bg-mint-100 text-ink-950 border border-mint-300',
  },
  con_incidencia: {
    label: 'Con incidencia',
    chipClass: 'bg-danger-100 text-danger-600',
  },
  devuelto: {
    label: 'Devuelto',
    chipClass: 'bg-danger-100 text-danger-600',
  },
  cancelado: {
    label: 'Cancelado',
    chipClass: 'bg-danger-100 text-danger-600',
  },
};

const FALLBACK_ESTADO_META = ESTADO_META.en_transito;

export function estadoMeta(estado: string): { label: string; chipClass: string } {
  return ESTADO_META[estado] ?? FALLBACK_ESTADO_META;
}

export const EVENT_TYPE_LABELS: Record<string, string> = {
  escaneo_sucursal: 'Escaneo en sucursal',
  cambio_estado: 'Cambio de estado',
  lectura_gps: 'Lectura GPS',
  asignacion_reparto: 'Asignación a reparto',
  entrega: 'Entrega',
  incidencia: 'Incidencia',
};

export function eventTitle(tipo: string): string {
  const mapped = EVENT_TYPE_LABELS[tipo];
  if (mapped) return mapped;
  const humanized = tipo.replace(/[_-]+/g, ' ').trim();
  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}

/** «10/11/2026»; if the date comes as «YYYY-MM-DD» it is respected literally. */
export function formatDateAr(iso: string | null | undefined): string {
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

/** «10/11/2026 · 18:00» en zona America/Argentina/Buenos_Aires. */
export function formatDateTimeAr(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: ART_TIMEZONE,
  }).format(date);
}

export function formatWeightKg(pesoKg: number): string {
  return pesoKg.toLocaleString('es-AR', { maximumFractionDigits: 2 });
}

/** Espaciador numérico genérico para km, horas y otras magnitudes. */
export function formatNumberAr(value: number): string {
  return value.toLocaleString('es-AR', { maximumFractionDigits: 2 });
}

export function formatArs(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(value);
}

/** Extract «valorDeclarado» (ARS) from a paquete caracteristicas list, if any. */
export function declaredValue(
  caracteristicas: Array<{ k: string; v: string | number | boolean }> | undefined,
): number | null {
  if (!caracteristicas) return null;

  for (const caracteristica of caracteristicas) {
    if (caracteristica.k !== 'valorDeclarado') continue;

    const value =
      typeof caracteristica.v === 'number'
        ? caracteristica.v
        : typeof caracteristica.v === 'string'
          ? Number(caracteristica.v)
          : Number.NaN;

    if (Number.isFinite(value) && value > 0) return value;
  }

  return null;
}

export const TRACKING_CODE_PATTERN = /^EY-[A-Z0-9]{6}$/i;
