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

/**
 * Registro público de clientes. Pide solo los datos mínimos del PRD:
 * la dirección de facturación se completa después, en el perfil.
 */
export interface RegisterDto {
  nombre: string;
  email: string;
  telefono: string;
  password: string;
  tipoCliente?: TipoCliente;
}

export interface LoginDto {
  email: string;
  password: string;
  recordarme?: boolean;
}

export interface AuthUserDto {
  _id: string;
  email: string;
  nombre: string;
  rol: RolUsuario;
  clienteId?: string;
}

export interface AuthResponseDto {
  usuario: AuthUserDto;
  mensaje: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  nombre: string;
  rol: RolUsuario;
  clienteId?: string;
}
