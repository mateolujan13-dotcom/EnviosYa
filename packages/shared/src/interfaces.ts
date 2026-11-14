import {
  EstadoEnvio,
  EstadoRepartidor,
  EstadoVehiculo,
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

export interface IPaqueteDimensiones {
  altoCm: number;
  anchoCm: number;
  profundoCm: number;
}

export interface IPaqueteCaracteristica {
  k: string;
  v: string | number | boolean;
}

export interface IPaquete {
  paqueteId?: string;
  descripcion: string;
  pesoKg: number;
  dimensiones: IPaqueteDimensiones;
  fragil: boolean;
  caracteristicas?: IPaqueteCaracteristica[];
}

export interface IEventoSeguimiento {
  tipo: TipoEvento | string;
  estado: EstadoEnvio | string;
  timestamp: Date | string;
  sucursalId?: string | null;
  repartidorId?: string | null;
  descripcion?: string;
}

export interface ICostoEnvio {
  flete: number;
  recargos: number;
  seguro: number;
  total: number;
}

export interface IEnvioDocument {
  _id: string; // Ej: "ENV-2026-0001"
  codigo: string; // Ej: "EY-4F8A1C"
  clienteId: string;
  clienteResumen?: {
    nombre: string;
    email?: string;
  };
  remitente: IPersona;
  destinatario: IPersona;
  paquetes: IPaquete[];
  totalPaquetes: number;
  pesoTotalKg: number;
  estado: EstadoEnvio | string;
  sucursalOrigenId: string;
  sucursalDestinoId: string;
  sucursalActualId?: string | null;
  repartidorId?: string | null;
  repartidorResumen?: {
    nombre: string;
    telefono?: string;
  };
  vehiculoId?: string | null;
  fechaCreacion: Date | string;
  fechaDespacho?: Date | string | null;
  fechaEntregaEstimada?: Date | string | null;
  fechaEntrega?: Date | string | null;
  costo: ICostoEnvio;
  facturaId?: string | null;
  ultimosEventos?: IEventoSeguimiento[];
  totalEventos?: number;
  motivoCancelacion?: string | null;
  schemaVersion?: number;
}

export interface IClienteDocument {
  _id: string; // Ej: "CLI-0001"
  tipo: TipoCliente | 'corporativo' | 'particular';
  razonSocial: string;
  cuit?: string;
  dni?: string;
  contacto: {
    nombre: string;
    email: string;
    telefono: string;
  };
  direccionFacturacion?: IDireccion;
  modalidadFacturacion?: string;
  fechaAlta: Date | string;
  activo: boolean;
  enviosPorMes?: number;
  esAtipico?: boolean;
  ultimosEnvios?: Array<{
    envioId: string;
    codigo: string;
    estado: string;
    fechaCreacion: Date | string;
    destino: string;
    total: number;
  }>;
  schemaVersion?: number;
}

export interface ISucursalDocument {
  _id: string; // Ej: "SUC-01"
  nombre: string;
  direccion: IDireccion;
  telefono: string;
  horario: string;
  activa: boolean;
  responsable?: string;
}

export interface IRepartidorDocument {
  _id: string; // Ej: "REP-01"
  nombre: string;
  documento: string;
  telefono: string;
  email: string;
  licencia?: {
    numero: string;
    categoria: string;
    vencimiento: Date | string;
  };
  sucursalBaseId: string;
  vehiculoAsignadoId?: string | null;
  rutasIds?: string[];
  estado: EstadoRepartidor | 'disponible' | 'en_reparto' | 'en_ruta' | 'inactivo';
  fechaIngreso: Date | string;
}

export interface IVehiculoDocument {
  _id: string; // Ej: "VEH-01"
  patente: string;
  tipo: TipoVehiculo | string;
  marca: string;
  modelo: string;
  anio: number;
  capacidadKg: number;
  capacidadM3: number;
  sucursalId: string;
  estado: EstadoVehiculo | 'operativo' | 'en_reparto' | 'mantenimiento';
  ultimoMantenimiento?: Date | string;
  cargaActualKg?: number;
}

export interface IUsuarioDocument {
  _id: string; // Ej: "USR-0001"
  email: string;
  passwordHash: string;
  nombre: string;
  rol: RolUsuario;
  clienteId?: string;
  activo: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ITarifaDocument {
  _id: string; // Ej: "TAR-ESTANDAR"
  nombre: string;
  precioBase: number;
  precioKm: number;
  precioKg: number;
  recargoFragilPorcentaje: number;
  tasaSeguroPorcentaje: number;
  alicuotaIva: number;
  moneda: string;
  vigenteDesde: Date | string;
  activa: boolean;
  schemaVersion?: number;
}
