/**
 * Coordenadas APROXIMADAS (±5 km) de las sucursales argentinas.
 *
 * Las direcciones de sucursal NO tienen coordenadas reales en la base;
 * estos valores son constantes de centroide urbano, usadas únicamente
 * para orientar el mapa público de seguimiento. Se rotulan como
 * aproximadas en la UI («Coordenadas aproximadas de sucursales
 * (orientativas)»). Si una ciudad no está en la tabla, el mapa no se
 * renderiza y se muestra un panel de respaldo.
 */
export const BRANCH_APPROX_COORDS: Record<string, { lat: number; lng: number }> = {
  // CABA / Buenos Aires
  caba: { lat: -34.6037, lng: -58.3816 },
  'buenos aires': { lat: -34.6037, lng: -58.3816 },
  'ciudad autonoma': { lat: -34.6037, lng: -58.3816 },
  'ciudad autonoma de buenos aires': { lat: -34.6037, lng: -58.3816 },
  'capital federal': { lat: -34.6037, lng: -58.3816 },
  cordoba: { lat: -31.4201, lng: -64.1888 },
  rosario: { lat: -32.9468, lng: -60.6393 },
  mendoza: { lat: -32.8895, lng: -68.8458 },
  'la plata': { lat: -34.9214, lng: -57.9544 },
};

const DIACRITICS_PATTERN = /[\u0300-\u036f]/g;

/** Normaliza una ciudad: trim, minúsculas, sin tildes, espacios colapsados. */
function normalizeCity(ciudad: string): string {
  return ciudad
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS_PATTERN, '')
    .replace(/\s+/g, ' ');
}

/**
 * Devuelve las coordenadas aproximadas de una ciudad conocida,
 * o `null` si no hay una entrada confiable (nunca lanza).
 */
export function lookupBranchCoords(ciudad: string): { lat: number; lng: number } | null {
  const normalized = normalizeCity(ciudad);
  return BRANCH_APPROX_COORDS[normalized] ?? null;
}
