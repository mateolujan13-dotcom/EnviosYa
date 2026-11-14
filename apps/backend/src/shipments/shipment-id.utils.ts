/**
 * Utilidades puras para la generación del `_id` de envíos y la estimación
 * de la fecha de entrega. Sin dependencias de Nest ni de Mongo.
 */

/** Prefijo del `_id`: `ENV-<año UTC>-`. */
export function envIdPrefix(date: Date): string {
  return `ENV-${date.getUTCFullYear()}-`;
}

/**
 * Calcula el próximo `_id` a partir del máximo existente (`ENV-2026-0012`
 * → `ENV-2026-0013`). Un máximo inexistente o malformado (sin sufijo
 * numérico) reinicia la secuencia en `0001` en lugar de fallar.
 */
export function nextEnvId(prefix: string, maxId: string | null): string {
  const match = maxId ? /(\d+)$/.exec(maxId) : null;
  const current = match ? Number.parseInt(match[1], 10) : Number.NaN;
  const next = Number.isFinite(current) ? current + 1 : 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

/**
 * Días estimados hasta la entrega: `max(1, ceil(distanciaKm / 500))`
 * (decisión del usuario 2026-11-14, ver spec S2).
 */
export function estimateDeliveryDays(distanciaKm: number): number {
  if (!Number.isFinite(distanciaKm) || distanciaKm <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(distanciaKm / 500));
}
