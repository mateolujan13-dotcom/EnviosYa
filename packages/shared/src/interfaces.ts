import {
  EstadoEnvio,
  EstadoRepartidor,
  EstadoVehiculo,
  ModalidadServicio,
  RolUsuario,
  TipoCliente,
  TipoEvento,
  TipoVehiculo,
} from './enums';

export interface IDireccion {
  calle: string;
  numero: number | string;
  ciudad: string;
  provincia: string;
  cp: string;
  coordenadas?: {
    lat: number;
    lng: number;
  };
}

export interface IPersona {
  nombre: string;
  direccion: IDireccion;
  telefono: string;
  email?: string;
}

export interface IPaquete {
  alto: number; // cm
  ancho: number; // cm
  largo: number; // cm
  peso: number; // kg
  fragil: boolean;
  descripcion?: string;
  valorDeclarado?: number;
}

export interface IEventoEnvio {
  tipo: TipoEvento;
  estado: EstadoEnvio;
  timestamp: Date | string;
  sucursalId?: string | null;
  repartidorId?: string | null;
  observaciones?: string;
}

export interface IEnvio {
  _id: string; // Ej: "ENV-2026-0001"
  codigoSeguimiento: string; // Ej: "EY-4F8A1C"
  remitente: IPersona;
  destinatario: IPersona;
  clienteId: string;
  origen: IDireccion;
  destino: IDireccion;
  sucursalOrigenId?: string;
  sucursalDestinoId?: string;
  distanciaKm: number;
  modalidad: ModalidadServicio;
  paquetes: IPaquete[];
  estado: EstadoEnvio;
  historialEventos: IEventoEnvio[];
  repartidorId?: string | null;
  vehiculoId?: string | null;
  cotizacion: {
    precioBase: number;
    adicionalDistancia: number;
    adicionalPeso: number;
    adicionalFragil: number;
    seguro: number;
    iva: number;
    total: number;
    moneda: string; // 'ARS'
  };
  motivoCancelacion?: string;
  fechaCreacion: Date | string;
  fechaEstimadaEntrega?: Date | string;
  fechaEntregaEfectiva?: Date | string;
}

export interface IUsuario {
  _id: string;
  email: string;
  passwordHash: string;
  nombre: string;
  rol: RolUsuario;
  clienteId?: string;
  activo: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ICliente {
  _id: string; // Ej: "CLI-001"
  nombre: string;
  tipo: TipoCliente;
  cuitCuil?: string;
  email: string;
  telefono: string;
  direccion: IDireccion;
  saldoCuentaCorriente?: number;
  activo: boolean;
}

export interface ISucursal {
  _id: string; // Ej: "SUC-CBA"
  nombre: string;
  codigo: string;
  direccion: IDireccion;
  telefono: string;
  horarioAtencion: string;
  capacidadAlmacenamientoM3: number;
  activo: boolean;
}

export interface IRepartidor {
  _id: string; // Ej: "REP-001"
  nombre: string;
  dni: string;
  telefono: string;
  sucursalId: string;
  estado: EstadoRepartidor;
  calificacionPromedio: number;
  totalEntregas: number;
}

export interface IVehiculo {
  _id: string; // Ej: "VEH-001"
  patente: string;
  modelo: string;
  marca: string;
  tipo: TipoVehiculo;
  capacidadCargaKg: number;
  capacidadVolumenM3: number;
  estado: EstadoVehiculo;
  sucursalId: string;
  cargaActualKg?: number;
}

export interface ITarifa {
  _id: string;
  nombre: string;
  precioBase: number;
  precioKm: number;
  precioKg: number;
  recargoFragilPorcentaje: number;
  tasaSeguroPorcentaje: number;
  alicuotaIva: number;
  activa: boolean;
}
