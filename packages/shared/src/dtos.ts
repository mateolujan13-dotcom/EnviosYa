import { EstadoEnvio, ModalidadServicio, RolUsuario, TipoCliente, TipoEvento } from './enums';
import { ICostoEnvio, IDireccion, IPaquete, IPersona } from './interfaces';

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
  /**
   * true cuando la distancia no proviene de OSRM sino del fallback
   * Haversine × 1.25 (servicio de ruteo no disponible).
   */
  distanciaEstimada: boolean;
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

/** Ciudad de origen o destino expuesta públicamente (sin dirección ni sucursal). */
export interface TrackingCityDto {
  ciudad: string;
  provincia: string;
}

/**
 * Evento de seguimiento público. Deliberadamente sin `sucursalId`,
 * `repartidorId` ni `_id`: el tracking público no expone datos operativos internos.
 */
export interface TrackingEventDto {
  tipo: TipoEvento | string;
  estado: EstadoEnvio | string;
  /** ISO 8601 UTC */
  timestamp: string;
  descripcion?: string;
}

/**
 * Ítem de la lista "Mis envíos" del cliente. Sin PII ajena ni interna.
 * `cancelado` es un flag plano: el validator TP9 no admite estado 'cancelado'.
 */
export interface ShipmentListItemDto {
  codigo: string;
  estado: EstadoEnvio | string;
  cancelado: boolean;
  destinoCiudad: string;
  /** ISO 8601 UTC */
  fechaCreacion: string;
  totalPaquetes: number;
  pesoTotalKg: number;
  total: number;
}

export interface ShipmentsPageDto {
  items: ShipmentListItemDto[];
  total: number;
  page: number;
  limit: number;
}

export interface ShipmentsSummaryDto {
  activos: number;
  entregadosEsteMes: number;
  gastoDelMes: number;
  totalEnvios: number;
}

/**
 * Detalle de un envío propio (portal del cliente). Remite/destinatario
 * son datos del propio cliente; seguro mostrarlos.
 */
export interface ShipmentDetailDto {
  codigo: string;
  estado: EstadoEnvio | string;
  cancelado: boolean;
  motivoCancelacion: string | null;
  remitente: IPersona;
  destinatario: IPersona;
  paquetes: IPaquete[];
  totalPaquetes: number;
  pesoTotalKg: number;
  costo: ICostoEnvio;
  fechaCreacion: string;
  fechaDespacho: string | null;
  fechaEntregaEstimada: string | null;
  fechaEntrega: string | null;
  ultimosEventos: TrackingEventDto[];
  totalEventos: number;
}

/** Entrada pública (compartido) del flujo "crear envío"; el backend revalida todo. */
export interface CreateShipmentInput {
  origen: IDireccion;
  destino: IDireccion;
  destinatario: { nombre: string; telefono: string };
  paquetes: IPaquete[];
  modalidad?: ModalidadServicio;
}

export interface CancelShipmentDto {
  motivo: string;
}

/** Ítem de la bandeja operativa (Torre de Control). El operador ve el cliente. */
export interface OpsShipmentListItemDto {
  codigo: string;
  estado: EstadoEnvio | string;
  cancelado: boolean;
  cliente: string;
  origenCiudad: string;
  destinoCiudad: string;
  totalPaquetes: number;
  pesoTotalKg: number;
  total: number;
  /** ISO 8601 UTC */
  fechaCreacion: string;
}

export interface OpsShipmentsPageDto {
  items: OpsShipmentListItemDto[];
  total: number;
  page: number;
  limit: number;
}

/** KPIs por estado (excluye cancelados). */
export interface OpsSummaryDto {
  pendiente: number;
  en_transito: number;
  en_sucursal: number;
  en_reparto: number;
  con_incidencia: number;
  entregado: number;
  devuelto: number;
  total: number;
}

/** Detalle operativo completo de un envío para la Torre de Control. */
export interface OpsShipmentDetailDto {
  codigo: string;
  estado: EstadoEnvio | string;
  cancelado: boolean;
  motivoCancelacion: string | null;
  clienteResumen: { nombre: string; email?: string };
  origen: TrackingCityDto;
  destino: TrackingCityDto;
  remitente: IPersona;
  destinatario: IPersona;
  paquetes: IPaquete[];
  totalPaquetes: number;
  pesoTotalKg: number;
  costo: ICostoEnvio;
  fechaCreacion: string;
  fechaDespacho: string | null;
  fechaEntregaEstimada: string | null;
  fechaEntrega: string | null;
  sucursalActualId: string | null;
  repartidor: { _id: string; nombre: string; telefono?: string } | null;
  vehiculo: {
    _id: string;
    patente: string;
    tipo: string;
    capacidadKg: number;
    cargaActualKg: number;
  } | null;
  ultimosEventos: TrackingEventDto[];
  totalEventos: number;
}

export interface AssignResourcesDto {
  repartidorId: string;
  vehiculoId: string;
}

export interface IncidentDto {
  /** Motivo obligatorio (≥5 caracteres). */
  observacion: string;
}

export interface ResolveIncidentDto {
  resolucion: 'en_sucursal' | 'en_reparto' | 'devuelto';
  observacion?: string;
}

/**
 * Respuesta pública de `GET /api/shipments/track/:code`.
 * Sin PII: no incluye remitente, destinatario, clienteResumen, costo,
 * repartidorResumen, clienteId, `_id` ni ningún campo de contacto.
 */
export interface PublicTrackingDto {
  codigo: string;
  estado: EstadoEnvio | string;
  origen: TrackingCityDto;
  destino: TrackingCityDto;
  totalPaquetes: number;
  pesoTotalKg: number;
  totalEventos: number;
  /** ISO 8601 UTC */
  fechaCreacion: string;
  fechaDespacho: string | null;
  fechaEntregaEstimada: string | null;
  fechaEntrega: string | null;
  /** Últimos 5 eventos, ordenados por timestamp ascendente. */
  ultimosEventos: TrackingEventDto[];
}
