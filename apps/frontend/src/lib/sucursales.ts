/**
 * Catálogo mínimo de las 5 sucursales TP9 para filtros y referencias de UI.
 * Espeja el seed (`script/partes/05_maestros.js`); la fuente de verdad son
 * los documentos reales en MongoDB.
 */
export interface SucursalOption {
  id: string;
  nombre: string;
  ciudad: string;
}

export const SUCURSALES: SucursalOption[] = [
  { id: 'SUC-01', nombre: 'Sucursal Central CABA', ciudad: 'CABA' },
  { id: 'SUC-02', nombre: 'Sucursal Córdoba', ciudad: 'Córdoba' },
  { id: 'SUC-03', nombre: 'Sucursal Rosario', ciudad: 'Rosario' },
  { id: 'SUC-04', nombre: 'Sucursal Mendoza', ciudad: 'Mendoza' },
  { id: 'SUC-05', nombre: 'Sucursal La Plata', ciudad: 'La Plata' },
];

export function sucursalNombre(id: string | null | undefined): string {
  if (!id) return '—';
  return SUCURSALES.find((sucursal) => sucursal.id === id)?.nombre ?? id;
}
