/**
 * Catálogo estático de la flota TP9 (seed `05_maestros.js`) para los selects
 * de «Asignación de recursos». Es una ayuda de UI: el estado operativo real
 * (disponible/en_reparto) y la capacidad residual se validan en el servidor;
 * un 409 se muestra verbatim al confirmar.
 */
export interface RepartidorSugerido {
  _id: string;
  nombre: string;
  telefono: string;
  sucursalBaseId: string;
  /** Estado al momento del seed; no refleja cambios en runtime. */
  estadoEnSemilla: 'disponible' | 'en_ruta';
}

export interface VehiculoSugerido {
  _id: string;
  patente: string;
  tipo: string;
  marca: string;
  modelo: string;
  capacidadKg: number;
  sucursalId: string;
  /** Estado al momento del seed; no refleja cambios en runtime. */
  estadoEnSemilla: 'operativo' | 'mantenimiento';
}

export const REPARTIDORES_SUGERIDOS: RepartidorSugerido[] = [
  { _id: 'REP-01', nombre: 'Carlos Díaz', telefono: '+54 351 555-0101', sucursalBaseId: 'SUC-02', estadoEnSemilla: 'disponible' },
  { _id: 'REP-02', nombre: 'Laura Fernández', telefono: '+54 351 555-0102', sucursalBaseId: 'SUC-02', estadoEnSemilla: 'en_ruta' },
  { _id: 'REP-03', nombre: 'Diego Sosa', telefono: '+54 11 5555-0103', sucursalBaseId: 'SUC-01', estadoEnSemilla: 'disponible' },
  { _id: 'REP-04', nombre: 'Mariana López', telefono: '+54 341 555-0104', sucursalBaseId: 'SUC-03', estadoEnSemilla: 'disponible' },
  { _id: 'REP-05', nombre: 'Pablo Romero', telefono: '+54 11 5555-0105', sucursalBaseId: 'SUC-01', estadoEnSemilla: 'en_ruta' },
];

export const VEHICULOS_SUGERIDOS: VehiculoSugerido[] = [
  { _id: 'VEH-01', patente: 'AB123CD', tipo: 'camioneta', marca: 'Ford', modelo: 'Transit', capacidadKg: 1200, sucursalId: 'SUC-02', estadoEnSemilla: 'operativo' },
  { _id: 'VEH-02', patente: 'AC456EF', tipo: 'camion', marca: 'Iveco', modelo: 'Daily', capacidadKg: 3500, sucursalId: 'SUC-02', estadoEnSemilla: 'operativo' },
  { _id: 'VEH-03', patente: 'AD789GH', tipo: 'camioneta', marca: 'Renault', modelo: 'Master', capacidadKg: 1500, sucursalId: 'SUC-01', estadoEnSemilla: 'operativo' },
  { _id: 'VEH-04', patente: 'AE012IJ', tipo: 'moto', marca: 'Honda', modelo: 'CG 150', capacidadKg: 50, sucursalId: 'SUC-03', estadoEnSemilla: 'operativo' },
  { _id: 'VEH-05', patente: 'AF345KL', tipo: 'camion', marca: 'Mercedes-Benz', modelo: 'Sprinter', capacidadKg: 3000, sucursalId: 'SUC-01', estadoEnSemilla: 'operativo' },
];
