import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  ICostoEnvio,
  IEnvioDocument,
  IEventoSeguimiento,
  IPaquete,
  IPersona,
  IRepartidorDocument,
  IVehiculoDocument,
  OpsShipmentDetailDto,
  OpsShipmentListItemDto,
  OpsShipmentsPageDto,
  OpsSummaryDto,
  TrackingEventDto,
} from '@envioya/shared';
import {
  IllegalTransitionError,
  ShipmentState,
  ShipmentAction,
  ShipmentsStateMachine,
} from './shipments-state-machine';
import { BucketEvent, EventBucketService } from './event-bucket.service';
import { MongoDatabaseService } from '../database/mongo-database.service';
import { FleetRepository } from '../repositories/fleet.repository';
import { ShipmentsRepository } from '../repositories/shipments.repository';
import {
  AssignResourcesDto,
  IncidentDto,
  OPS_ESTADOS,
  OpsShipmentsQueryDto,
  ResolveIncidentDto,
} from './dto/ops.dto';
import { Filter, UpdateFilter } from 'mongodb';

const CODIGO_PATTERN = /^EY-[A-Z0-9]{6}$/;

/** El validator TP9 no admite estado 'cancelado': flag plano. */
export type EnvioConFlag = IEnvioDocument & { cancelado?: boolean };

const LIST_ESTADOS = OPS_ESTADOS as readonly string[];

interface TimelineEvent extends IEventoSeguimiento {
  tipo: string;
  estado: string;
  timestamp: Date;
  sucursalId: string | null;
  repartidorId: string | null;
  descripcion: string;
}

@Injectable()
export class OpsService {
  constructor(
    private readonly shipments: ShipmentsRepository,
    private readonly fleet: FleetRepository,
    private readonly buckets: EventBucketService,
    private readonly mongo: MongoDatabaseService,
  ) {}

  // ------------------------------------------------------------------
  // Lecturas
  // ------------------------------------------------------------------

  async list(query: OpsShipmentsQueryDto): Promise<OpsShipmentsPageDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 10));
    const estado = query.estado;
    if (estado && !LIST_ESTADOS.includes(estado)) {
      // Defensa en profundidad: el DTO ya valida con @IsIn.
      throw new BadRequestException('Estado fuera del enum');
    }

    const filter: Record<string, unknown> = {};
    if (estado) filter['estado'] = estado;
    if (query.sucursalId) {
      filter['$or'] = [
        { sucursalOrigenId: query.sucursalId },
        { sucursalActualId: query.sucursalId },
        { sucursalDestinoId: query.sucursalId },
      ];
    }
    if (query.q) {
      filter['codigo'] = {
        $regex: escapeRegex(query.q.trim()),
        $options: 'i',
      };
    }

    const { items, total } = await this.shipments.findAll(
      filter as Filter<IEnvioDocument>,
      page,
      limit,
    );

    return {
      items: items.map(toListItem),
      total,
      page,
      limit,
    };
  }

  /** KPIs por estado, excluyendo `cancelado: true`. */
  async summary(): Promise<OpsSummaryDto> {
    const rows = await this.mongo
      .getDb()
      .collection('envios')
      .aggregate<{ _id: string; count: number }>([
        { $match: { cancelado: { $ne: true } } },
        { $group: { _id: '$estado', count: { $sum: 1 } } },
      ])
      .toArray();

    const counts = Object.fromEntries(
      rows.map((row) => [row._id, Number(row.count)]),
    ) as Record<string, number>;

    const dto: OpsSummaryDto = {
      pendiente: counts['pendiente'] ?? 0,
      en_transito: counts['en_transito'] ?? 0,
      en_sucursal: counts['en_sucursal'] ?? 0,
      en_reparto: counts['en_reparto'] ?? 0,
      con_incidencia: counts['con_incidencia'] ?? 0,
      entregado: counts['entregado'] ?? 0,
      devuelto: counts['devuelto'] ?? 0,
      total: 0,
    };
    dto.total =
      dto.pendiente +
      dto.en_transito +
      dto.en_sucursal +
      dto.en_reparto +
      dto.con_incidencia +
      dto.entregado +
      dto.devuelto;
    return dto;
  }

  async detail(codigo: string): Promise<OpsShipmentDetailDto> {
    const doc = await this.findOpsDoc(codigo);
    return this.toDetail(doc);
  }

  // ------------------------------------------------------------------
  // Mutaciones
  // ------------------------------------------------------------------

  async assign(
    codigo: string,
    dto: AssignResourcesDto,
  ): Promise<OpsShipmentDetailDto> {
    const { doc, now } = await this.loadForMutation(codigo, 'assign');
    const peso = doc.pesoTotalKg;

    // 1) Repartidor: existe y está disponible (salvo que sea el mismo par).
    const repartidor = await this.fleet.findRepartidorById(dto.repartidorId);
    if (!repartidor) {
      throw new BadRequestException('Repartidor no encontrado');
    }
    if (
      repartidor.estado !== 'disponible' &&
      doc.repartidorId !== dto.repartidorId
    ) {
      throw new ConflictException('El repartidor no está disponible');
    }

    // 2) Vehículo: existe, operativo/disponible y con capacidad residual.
    const vehiculo = await this.fleet.findVehiculoById(dto.vehiculoId);
    if (!vehiculo) {
      throw new BadRequestException('Vehículo no encontrado');
    }
    if (vehiculo.estado !== 'operativo' && vehiculo.estado !== 'disponible') {
      throw new ConflictException('El vehículo no está operativo');
    }
    const cargaPrevia = vehiculo.cargaActualKg ?? 0;
    const residual = vehiculo.capacidadKg - cargaPrevia;
    if (residual < peso) {
      throw new ConflictException(
        `Capacidad insuficiente del vehículo (disponible: ${residual} kg)`,
      );
    }

    // 3) Libera el par previo (si existía): repartidor en_reparto → disponible;
    //    vehículo pierde el peso del envío con piso en 0.
    await this.releaseAssignment(doc);

    // 4) Aplica el nuevo par. Para el mismo vehículo, parte del valor post-release.
    const cargaBase =
      doc.vehiculoId === vehiculo._id ? Math.max(0, cargaPrevia - peso) : cargaPrevia;
    await this.fleet.updateRepartidor(repartidor._id, {
      $set: { estado: 'en_reparto' },
    });
    await this.fleet.updateVehiculo(vehiculo._id, {
      $set: { cargaActualKg: cargaBase + peso },
    });

    const nextState = this.nextStateFor('assign', doc.estado);
    await this.commit(doc, now, {
      set: {
        repartidorId: repartidor._id,
        vehiculoId: vehiculo._id,
        repartidorResumen: {
          nombre: repartidor.nombre,
          ...(repartidor.telefono !== undefined
            ? { telefono: repartidor.telefono }
            : {}),
        },
        estado: nextState,
      },
      eventTipo: 'asignacion_reparto',
      eventState: nextState,
      eventRepartidorId: repartidor._id,
      eventSucursalId: doc.sucursalActualId ?? null,
      eventDescripcion: `Asignación a repartidor ${repartidor.nombre}`,
    });

    return this.afterCommit(codigo);
  }

  async dispatch(codigo: string): Promise<OpsShipmentDetailDto> {
    const { doc, now } = await this.loadForMutation(codigo, 'dispatch');

    await this.commit(doc, now, {
      set: {
        estado: 'en_transito',
        sucursalActualId: null,
        fechaDespacho: now,
      },
      eventTipo: 'cambio_estado',
      eventState: 'en_transito',
      eventRepartidorId: doc.repartidorId ?? null,
      eventSucursalId: doc.sucursalActualId ?? doc.sucursalOrigenId ?? null,
      eventDescripcion: 'Despacho desde sucursal origen',
    });

    return this.afterCommit(codigo);
  }

  async arrive(codigo: string): Promise<OpsShipmentDetailDto> {
    const { doc, now } = await this.loadForMutation(codigo, 'arrive');

    // fechaEntregaEstimada no se toca.
    await this.commit(doc, now, {
      set: {
        estado: 'en_sucursal',
        sucursalActualId: doc.sucursalDestinoId,
      },
      eventTipo: 'escaneo_sucursal',
      eventState: 'en_sucursal',
      eventRepartidorId: doc.repartidorId ?? null,
      eventSucursalId: doc.sucursalDestinoId ?? null,
      eventDescripcion: 'Ingreso a sucursal destino',
    });

    return this.afterCommit(codigo);
  }

  async deliver(codigo: string): Promise<OpsShipmentDetailDto> {
    const { doc, now } = await this.loadForMutation(codigo, 'deliver');

    if (doc.repartidorId) {
      const repartidor = await this.fleet.findRepartidorById(doc.repartidorId);
      if (repartidor) {
        await this.fleet.updateRepartidor(repartidor._id, {
          $set: { estado: 'disponible' },
        });
      }
    }
    if (doc.vehiculoId) {
      const vehiculo = await this.fleet.findVehiculoById(doc.vehiculoId);
      if (vehiculo) {
        const carga = vehiculo.cargaActualKg ?? 0;
        await this.fleet.updateVehiculo(vehiculo._id, {
          $set: { cargaActualKg: Math.max(0, carga - doc.pesoTotalKg) },
        });
      }
    }

    await this.commit(doc, now, {
      set: {
        estado: 'entregado',
        fechaEntrega: now,
        sucursalActualId: doc.sucursalDestinoId ?? doc.sucursalActualId ?? null,
      },
      eventTipo: 'entrega',
      eventState: 'entregado',
      eventRepartidorId: doc.repartidorId ?? null,
      eventSucursalId: doc.sucursalDestinoId ?? doc.sucursalActualId ?? null,
      eventDescripcion: 'Entregado al destinatario',
    });

    return this.afterCommit(codigo);
  }

  async incident(
    codigo: string,
    dto: IncidentDto,
  ): Promise<OpsShipmentDetailDto> {
    const observacion = (dto.observacion ?? '').trim();
    if (observacion.length < 5) {
      // El DTO ya valida; defensa en profundidad.
      throw new BadRequestException('La observación debe tener al menos 5 caracteres');
    }

    const { doc, now } = await this.loadForMutation(codigo, 'incident');

    await this.commit(doc, now, {
      set: { estado: 'con_incidencia' },
      eventTipo: 'incidencia',
      eventState: 'con_incidencia',
      eventRepartidorId: doc.repartidorId ?? null,
      eventSucursalId: doc.sucursalActualId ?? null,
      eventDescripcion: observacion,
    });

    return this.afterCommit(codigo);
  }

  async resolveIncident(
    codigo: string,
    dto: ResolveIncidentDto,
  ): Promise<OpsShipmentDetailDto> {
    const resolucion = dto.resolucion;
    if (
      resolucion !== 'en_sucursal' &&
      resolucion !== 'en_reparto' &&
      resolucion !== 'devuelto'
    ) {
      throw new BadRequestException('Resolución fuera del enum');
    }
    const observacion = dto.observacion?.trim() ? dto.observacion.trim() : undefined;

    // resolve-incident se valida en la FSM con la resolucion (target = resolución).
    const { doc, now } = await this.loadForMutation(codigo, 'resolve-incident', {
      resolucion,
    });

    const descripcion = observacion
      ? `Incidencia resuelta: ${resolucion} — ${observacion}`
      : `Incidencia resuelta: ${resolucion}`;

    await this.commit(doc, now, {
      set: { estado: resolucion },
      eventTipo: 'cambio_estado',
      eventState: resolucion,
      eventRepartidorId: doc.repartidorId ?? null,
      eventSucursalId: doc.sucursalActualId ?? null,
      eventDescripcion: descripcion,
    });

    return this.afterCommit(codigo);
  }

  // ------------------------------------------------------------------
  // Internos
  // ------------------------------------------------------------------

  /** Flujo común de mutación: valida codigo, 404, 409 cancelado y FSM. */
  private async loadForMutation(
    codigo: string,
    action: ShipmentAction,
    options: { resolucion?: string } = {},
  ): Promise<{ doc: EnvioConFlag; now: Date }> {
    const doc = await this.findOpsDoc(codigo);

    if (doc.cancelado === true) {
      throw new ConflictException('El envío está cancelado');
    }

    const now = new Date();
    try {
      ShipmentsStateMachine.nextStateFor(action, doc.estado, options);
    } catch (error) {
      if (error instanceof IllegalTransitionError) {
        throw new ConflictException(error.message);
      }

      throw error;
    }

    return { doc, now };
  }

  private async findOpsDoc(codigo: string): Promise<EnvioConFlag> {
    if (!CODIGO_PATTERN.test(codigo)) {
      throw new BadRequestException('Código de envío inválido');
    }

    const doc = await this.shipments.findByCodigo(codigo);
    if (!doc) {
      throw new NotFoundException('Envío no encontrado');
    }

    return doc as EnvioConFlag;
  }

  private nextStateFor(
    action: ShipmentAction,
    current: string,
    options: { resolucion?: string } = {},
  ): ShipmentState {
    try {
      return ShipmentsStateMachine.nextStateFor(action, current, options);
    } catch (error) {
      if (error instanceof IllegalTransitionError) {
        throw new ConflictException(error.message);
      }

      throw error;
    }
  }

  /** Par previo del envío repartidor/vehículo liberado con las reglas del contrato. */
  private async releaseAssignment(doc: EnvioConFlag): Promise<void> {
    const peso = doc.pesoTotalKg;

    if (doc.repartidorId) {
      const prevRepartidor = await this.fleet.findRepartidorById(doc.repartidorId);
      if (prevRepartidor?.estado === 'en_reparto') {
        await this.fleet.updateRepartidor(prevRepartidor._id, {
          $set: { estado: 'disponible' },
        });
      }
    }

    if (doc.vehiculoId) {
      const prevVehiculo = await this.fleet.findVehiculoById(doc.vehiculoId);
      if (prevVehiculo) {
        const prevCarga = prevVehiculo.cargaActualKg ?? 0;
        await this.fleet.updateVehiculo(prevVehiculo._id, {
          $set: { cargaActualKg: Math.max(0, prevCarga - peso) },
        });
      }
    }
  }

  /**
   * Persiste el envío ($set + ultimosEventos recortado a 5 + totalEventos++)
   * y después el bucket del día en eventos_seguimiento (A3: sin transacción,
   * el envío primero y el bucket después).
   */
  private async commit(
    doc: EnvioConFlag,
    now: Date,
    plan: {
      set: Record<string, unknown>;
      eventTipo: string;
      eventState: string;
      eventRepartidorId: string | null;
      eventSucursalId: string | null;
      eventDescripcion: string;
    },
  ): Promise<void> {
    const timelineEvent: TimelineEvent = {
      tipo: plan.eventTipo,
      estado: plan.eventState,
      timestamp: now,
      sucursalId: plan.eventSucursalId,
      repartidorId: plan.eventRepartidorId,
      descripcion: plan.eventDescripcion,
    };

    const bucketEvent: BucketEvent = {
      tipo: plan.eventTipo,
      estado: plan.eventState,
      timestamp: now,
      sucursalId: plan.eventSucursalId,
      repartidorId: plan.eventRepartidorId,
      ubicacion: null,
      observacion: plan.eventDescripcion,
    };

    const updated = await this.shipments.updateOne(doc._id, {
      $set: plan.set,
      $push: {
        ultimosEventos: { $each: [timelineEvent], $slice: -5 },
      },
      $inc: { totalEventos: 1 },
    } as unknown as UpdateFilter<IEnvioDocument>);

    if (!updated) {
      throw new InternalServerErrorException('No se pudo actualizar el envío');
    }

    await this.buckets.append(doc._id, bucketEvent, now);
  }

  private async afterCommit(codigo: string): Promise<OpsShipmentDetailDto> {
    const doc = await this.findOpsDoc(codigo);
    return this.toDetail(doc);
  }

  private async toDetail(doc: EnvioConFlag): Promise<OpsShipmentDetailDto> {
    const [repartidor, vehiculo] = await Promise.all([
      doc.repartidorId ? this.fleet.findRepartidorById(doc.repartidorId) : null,
      doc.vehiculoId ? this.fleet.findVehiculoById(doc.vehiculoId) : null,
    ]);

    return {
      codigo: doc.codigo,
      estado: doc.estado,
      cancelado: doc.cancelado === true,
      motivoCancelacion: doc.motivoCancelacion ?? null,
      clienteResumen: toClienteResumen(doc),
      origen: {
        ciudad: doc.remitente?.direccion?.ciudad ?? '',
        provincia: doc.remitente?.direccion?.provincia ?? '',
      },
      destino: {
        ciudad: doc.destinatario?.direccion?.ciudad ?? '',
        provincia: doc.destinatario?.direccion?.provincia ?? '',
      },
      remitente: toPersona(doc.remitente),
      destinatario: toPersona(doc.destinatario),
      paquetes: (doc.paquetes ?? []).map(toPaquete),
      totalPaquetes: doc.totalPaquetes,
      pesoTotalKg: doc.pesoTotalKg,
      costo: toCosto(doc.costo),
      fechaCreacion: requiredIso(doc.fechaCreacion, 'fechaCreacion'),
      fechaDespacho: toIsoStringOrNull(doc.fechaDespacho),
      fechaEntregaEstimada: toIsoStringOrNull(doc.fechaEntregaEstimada),
      fechaEntrega: toIsoStringOrNull(doc.fechaEntrega),
      sucursalActualId: doc.sucursalActualId ?? null,
      repartidor: toRepartidor(doc, repartidor),
      vehiculo: toVehiculo(vehiculo),
      ultimosEventos: toTimeline(doc.ultimosEventos),
      totalEventos: doc.totalEventos ?? 0,
    };
  }
}

// ----------------------------------------------------------------------
// Mappers (nunca se devuelve el documento crudo ni `_id` de Mongo)
// ----------------------------------------------------------------------

function toListItem(doc: EnvioConFlag): OpsShipmentListItemDto {
  return {
    codigo: doc.codigo,
    estado: doc.estado,
    cancelado: doc.cancelado === true,
    cliente: doc.clienteResumen?.nombre ?? '',
    origenCiudad: doc.remitente?.direccion?.ciudad ?? '',
    destinoCiudad: doc.destinatario?.direccion?.ciudad ?? '',
    totalPaquetes: doc.totalPaquetes,
    pesoTotalKg: doc.pesoTotalKg,
    total: doc.costo?.total ?? 0,
    fechaCreacion: requiredIso(doc.fechaCreacion, 'fechaCreacion'),
  };
}

function toClienteResumen(doc: EnvioConFlag): {
  nombre: string;
  email?: string;
} {
  const nombre = doc.clienteResumen?.nombre ?? '';
  const email = doc.clienteResumen?.email;
  return email !== undefined ? { nombre, email } : { nombre };
}

function toRepartidor(
  doc: EnvioConFlag,
  repartidor: IRepartidorDocument | null,
): { _id: string; nombre: string; telefono?: string } | null {
  if (!doc.repartidorId) {
    return null;
  }

  const nombre = repartidor?.nombre ?? doc.repartidorResumen?.nombre ?? '';
  const telefono = repartidor?.telefono ?? doc.repartidorResumen?.telefono;

  return telefono !== undefined
    ? { _id: doc.repartidorId, nombre, telefono }
    : { _id: doc.repartidorId, nombre };
}

function toVehiculo(
  vehiculo: IVehiculoDocument | null,
): {
  _id: string;
  patente: string;
  tipo: string;
  capacidadKg: number;
  cargaActualKg: number;
} | null {
  if (!vehiculo) {
    return null;
  }

  return {
    _id: vehiculo._id,
    patente: vehiculo.patente,
    tipo: String(vehiculo.tipo),
    capacidadKg: vehiculo.capacidadKg,
    cargaActualKg: vehiculo.cargaActualKg ?? 0,
  };
}

function toPersona(persona: IPersona | undefined): IPersona {
  const direccion = persona?.direccion ?? {
    calle: '',
    numero: '',
    ciudad: '',
    provincia: '',
    cp: '',
  };

  return {
    nombre: persona?.nombre ?? '',
    direccion: {
      calle: direccion.calle,
      numero: direccion.numero,
      ciudad: direccion.ciudad,
      provincia: direccion.provincia,
      cp: direccion.cp,
    },
    telefono: persona?.telefono ?? '',
    ...(persona?.email !== undefined ? { email: persona.email } : {}),
  };
}

function toPaquete(paquete: IPaquete) {
  return {
    ...(paquete.paqueteId !== undefined ? { paqueteId: paquete.paqueteId } : {}),
    descripcion: paquete.descripcion,
    pesoKg: paquete.pesoKg,
    dimensiones: {
      altoCm: paquete.dimensiones.altoCm,
      anchoCm: paquete.dimensiones.anchoCm,
      profundoCm: paquete.dimensiones.profundoCm,
    },
    fragil: paquete.fragil,
    ...(paquete.caracteristicas !== undefined
      ? { caracteristicas: paquete.caracteristicas }
      : {}),
  };
}

function toCosto(costo: ICostoEnvio): ICostoEnvio {
  return {
    flete: costo.flete,
    recargos: costo.recargos,
    seguro: costo.seguro,
    total: costo.total,
  };
}

function toTimeline(
  events: IEnvioDocument['ultimosEventos'],
): TrackingEventDto[] {
  return (events ?? [])
    .map((event: IEventoSeguimiento): TrackingEventDto | null => {
      const timestamp = new Date(event.timestamp);
      if (Number.isNaN(timestamp.getTime())) {
        return null;
      }

      return {
        tipo: event.tipo,
        estado: event.estado,
        timestamp: timestamp.toISOString(),
        ...(event.descripcion !== undefined
          ? { descripcion: event.descripcion }
          : {}),
      };
    })
    .filter((event): event is TrackingEventDto => event !== null)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    .slice(-5);
}

function toIsoStringOrNull(value?: Date | string | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function requiredIso(
  value: Date | string | null | undefined,
  field: string,
): string {
  const iso = toIsoStringOrNull(value);
  if (iso === null) {
    throw new InternalServerErrorException(`El envío no tiene un ${field} válido`);
  }
  return iso;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
