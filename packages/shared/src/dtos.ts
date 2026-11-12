import { ModalidadServicio, RolUsuario, TipoCliente } from './enums';
import { IPaquete } from './interfaces';

export interface CotizarEnvioDto {
  origen: {
    calle: string;
    numero: number | string;
    ciudad: string;
    provincia: string;
    cp: string;
  };
  destino: {
    calle: string;
    numero: number | string;
    ciudad: string;
    provincia: string;
    cp: string;
  };
  paquetes: IPaquete[];
  modalidad: ModalidadServicio;
  sucursalOrigenId?: string;
  sucursalDestinoId?: string;
}

export interface CotizacionResultadoDto {
  distanciaKm: number;
  duracionEstimadaHoras: number;
  pesoTotalKg: number;
  volumenTotalM3: number;
  desglose: {
    precioBase: number;
    adicionalDistancia: number;
    adicionalPeso: number;
    adicionalFragil: number;
    seguro: number;
    subtotal: number;
    iva: number;
    total: number;
  };
  moneda: string;
}

export interface RegisterDto {
  nombre: string;
  email: string;
  password: string;
  telefono: string;
  tipoCliente: TipoCliente;
  cuitCuil?: string;
  direccion: {
    calle: string;
    numero: number | string;
    ciudad: string;
    provincia: string;
    cp: string;
  };
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponseDto {
  usuario: {
    _id: string;
    email: string;
    nombre: string;
    rol: RolUsuario;
    clienteId?: string;
  };
  mensaje: string;
}
