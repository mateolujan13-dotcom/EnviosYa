export enum EstadoEnvio {
  PENDIENTE = 'pendiente',
  EN_TRANSITO = 'en_transito',
  EN_SUCURSAL = 'en_sucursal',
  EN_REPARTO = 'en_reparto',
  ENTREGADO = 'entregado',
  CON_INCIDENCIA = 'con_incidencia',
  DEVUELTO = 'devuelto',
  CANCELADO = 'cancelado',
}

export enum TipoEvento {
  ESCANEO_SUCURSAL = 'escaneo_sucursal',
  CAMBIO_ESTADO = 'cambio_estado',
  LECTURA_GPS = 'lectura_gps',
  ASIGNACION_REPARTO = 'asignacion_reparto',
  ENTREGA = 'entrega',
  INCIDENCIA = 'incidencia',
}

export enum RolUsuario {
  CLIENTE = 'cliente',
  OPERADOR = 'operador',
  ADMIN = 'admin',
}

export enum TipoCliente {
  PARTICULAR = 'particular',
  EMPRESA = 'empresa',
}

export enum TipoVehiculo {
  MOTO = 'moto',
  UTILITARIO = 'utilitario',
  FURGON = 'furgon',
  CAMION = 'camion',
}

export enum EstadoVehiculo {
  DISPONIBLE = 'disponible',
  EN_RUTA = 'en_ruta',
  EN_TALLER = 'en_taller',
  INACTIVO = 'inactivo',
}

export enum EstadoRepartidor {
  DISPONIBLE = 'disponible',
  EN_REPARTO = 'en_reparto',
  FRANCO = 'franco',
  LICENCIA = 'licencia',
}

export enum ModalidadServicio {
  ESTANDAR = 'estandar',
  EXPRESS = 'express',
  SAME_DAY = 'same_day',
}
