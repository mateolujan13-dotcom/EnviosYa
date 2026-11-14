import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ICostoEnvio,
  IEnvioDocument,
  IEventoSeguimiento,
  IPaquete,
  IPersona,
  ISucursalDocument,
  ShipmentsPageDto,
  ShipmentsSummaryDto,
  ShipmentDetailDto,
  ShipmentListItemDto,
  TrackingEventDto,
} from '@envioya/shared';
import { randomInt } from 'node:crypto';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { haversineKm } from '../geo/haversine';
import { GeoService } from '../geo/geo.service';
import { PricingService } from '../pricing/pricing.service';
import { BranchesRepository } from '../repositories/branches.repository';
import { ClientsRepository } from '../repositories/clients.repository';
import { ShipmentsRepository } from '../repositories/shipments.repository';
import {
  CreateShipmentDto,
  CancelShipmentDto,
  ShipmentsQueryDto,
} from './dto/create-shipment.dto';
import { envIdPrefix, estimateDeliveryDays, nextEnvId } from './shipment-id.utils';

const CODIGO_ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const MAX_CODIGO_ATTEMPTS = 5;
const MAX_INSERT_ATTEMPTS = 5;

/** El validator TP9 no admite estado 'cancelado': flag plano + evento. */
export type EnvioConFlag = IEnvioDocument & { cancelado?: boolean };

/** Documento a insertar: amplía el tipo compartido con los nulos permitidos por el validador. */
type EnvioCandidate = Omit<IEnvioDocument, 'repartidorResumen'> & {
  repartidorResumen: { nombre: string; telefono?: string } | null;
  cancelado: boolean;
  motivoCancelacion: string | null;
};

@Injectable()
export class ClientShipmentsService {
  constructor(
    private readonly shipments: ShipmentsRepository,
    private readonly clients: ClientsRepository,
    private readonly branches: BranchesRepository,
    private readonly pricing: PricingService,
    private readonly geo: GeoService,
  ) {}

  async create(
    session: AuthenticatedUser,
    dto: CreateShipmentDto,
  ): Promise<ShipmentDetailDto> {
    const clienteId = session.clienteId;
    if (!clienteId) {
      throw new UnauthorizedException('La sesión no tiene un cliente asociado');
    }

    const cliente = await this.clients.findById(clienteId);
    if (!cliente) {
      throw new UnauthorizedException('El cliente de la sesión no existe');
    }

    // Costo server-side: nunca se confía en precios enviados por el cliente.
    const quote = await this.pricing.quote({
      origen: dto.origen,
      destino: dto.destino,
      paquetes: dto.paquetes,
      modalidad: dto.modalidad,
    });

    const now = new Date();
    const [sucursalOrigenId, sucursalDestinoId] = await this.nearestSucursales(
      dto.origen,
      dto.destino,
    );

    const fechaEntregaEstimada = new Date(
      now.getTime() + estimateDeliveryDays(quote.distanciaKm) * 86400000,
    );

    const paquetes = dto.paquetes.map((paquete, index) => ({
      ...paquete,
      paqueteId: generatePaqueteId(now, index),
    }));

    const prefix = envIdPrefix(now);
    let doc: EnvioCandidate | null = null;

    for (let attempt = 1; attempt <= MAX_INSERT_ATTEMPTS && !doc; attempt += 1) {
      const maxId = await this.shipments.findMaxIdByPrefix(prefix);
      const _id = nextEnvId(prefix, maxId);
      const codigo = await this.uniqueCodigo();

      const candidate: EnvioCandidate = {
        _id,
        codigo,
        clienteId,
        clienteResumen: {
          nombre: cliente.contacto.nombre,
          email: cliente.contacto.email,
        },
        remitente: {
          nombre: cliente.contacto.nombre,
          direccion: dto.origen,
          telefono: cliente.contacto.telefono,
          email: cliente.contacto.email,
        },
        destinatario: {
          nombre: dto.destinatario.nombre,
          direccion: dto.destino,
          telefono: dto.destinatario.telefono,
        },
        paquetes,
        totalPaquetes: paquetes.length,
        pesoTotalKg: quote.pesoTotalKg,
        estado: 'pendiente',
        sucursalOrigenId,
        sucursalDestinoId,
        sucursalActualId: null,
        repartidorId: null,
        repartidorResumen: null,
        vehiculoId: null,
        fechaCreacion: now,
        fechaDespacho: null,
        fechaEntregaEstimada,
        fechaEntrega: null,
        costo: {
          flete: round2(
            quote.desglose.precioBase +
              quote.desglose.adicionalDistancia +
              quote.desglose.adicionalPeso,
          ),
          recargos: quote.desglose.adicionalFragil,
          seguro: quote.desglose.seguro,
          total: quote.desglose.total,
        },
        facturaId: null,
        ultimosEventos: [
          {
            tipo: 'cambio_estado',
            estado: 'pendiente',
            timestamp: now,
            sucursalId: sucursalOrigenId,
            repartidorId: null,
            descripcion: 'Envío creado',
          },
        ],
        totalEventos: 1,
        schemaVersion: 1,
        cancelado: false,
        motivoCancelacion: null,
      };

      try {
        await this.shipments.insertOne(candidate as unknown as IEnvioDocument);
        doc = candidate;
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          if (attempt < MAX_INSERT_ATTEMPTS) {
            continue;
          }

          throw new ConflictException(
            'No se pudo crear el envío: conflicto de identificador',
          );
        }

        throw error;
      }
    }

    if (!doc) {
      // Inalcanzable: el loop siempre setea doc o lanza.
      throw new InternalServerErrorException('No se pudo crear el envío');
    }

    return toDetail(doc as unknown as EnvioConFlag);
  }

  async list(
    session: AuthenticatedUser,
    query: ShipmentsQueryDto,
  ): Promise<ShipmentsPageDto> {
    const clienteId = requireClienteId(session);
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 10));
    const cancelado =
      query.cancelados === 'true'
        ? true
        : query.cancelados === 'false'
          ? false
          : undefined;

    const { items, total } = await this.shipments.findOwnPaged(
      clienteId,
      page,
      limit,
      query.estado,
      cancelado,
    );

    return {
      items: items.map(toListItem),
      total,
      page,
      limit,
    };
  }

  async summary(session: AuthenticatedUser): Promise<ShipmentsSummaryDto> {
    const clienteId = requireClienteId(session);
    const now = new Date();
    const startOfMonthUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    const summary = await this.shipments.summaryForCliente(
      clienteId,
      startOfMonthUtc,
    );

    return {
      activos: summary.activos,
      entregadosEsteMes: summary.entregadosEsteMes,
      gastoDelMes: round2(summary.gastoDelMes),
      totalEnvios: summary.totalEnvios,
    };
  }

  async detail(
    session: AuthenticatedUser,
    codigo: string,
  ): Promise<ShipmentDetailDto> {
    const clienteId = requireClienteId(session);
    const doc = await this.findOwnDoc(codigo, clienteId);
    return toDetail(doc);
  }

  async cancel(
    session: AuthenticatedUser,
    codigo: string,
    dto: CancelShipmentDto,
  ): Promise<ShipmentDetailDto> {
    const clienteId = requireClienteId(session);
    const motivo = dto.motivo.trim();

    if (motivo.length < 5) {
      // El DTO ya valida; defensa en profundidad.
      throw new BadRequestException('El motivo debe tener al menos 5 caracteres');
    }

    const doc = await this.findOwnDoc(codigo, clienteId);

    if (
      doc.cancelado === true ||
      doc.estado !== 'pendiente' ||
      (doc.repartidorId ?? null) !== null
    ) {
      throw new ConflictException('El envío no puede cancelarse en su estado actual');
    }

    const now = new Date();
    const updated = await this.shipments.applyCancellation(doc._id, motivo, {
      tipo: 'cambio_estado',
      estado: 'pendiente',
      timestamp: now,
      sucursalId: doc.sucursalActualId ?? null,
      repartidorId: null,
      descripcion: `Cancelado por el cliente: ${motivo}`,
    });

    if (!updated) {
      // Perdió la carrera contra otra cancelación/transición.
      throw new ConflictException('El envío no puede cancelarse en su estado actual');
    }

    return toDetail(updated);
  }

  private async findOwnDoc(
    codigo: string,
    clienteId: string,
  ): Promise<EnvioConFlag> {
    const doc = await this.shipments.findByCodigo(codigo);
    if (!doc || doc.clienteId !== clienteId) {
      // 404 siempre: nunca revelar si el envío existe pero es ajeno.
      throw new NotFoundException('Envío no encontrado');
    }
    return doc as EnvioConFlag;
  }

  private async nearestSucursales(
    origen: { calle: string; numero: string | number; ciudad: string; provincia: string; cp: string },
    destino: { calle: string; numero: string | number; ciudad: string; provincia: string; cp: string },
  ): Promise<[string, string]> {
    const sucursales = await this.branches.findAll();
    if (sucursales.length === 0) {
      throw new InternalServerErrorException('No hay sucursales disponibles');
    }

    const [origenCoords, destinoCoords] = await Promise.all([
      this.geo.geocodeAddress(origen),
      this.geo.geocodeAddress(destino),
    ]);

    const coords = await Promise.all(
      sucursales.map((sucursal) =>
        this.geo.geocodeAddress(sucursal.direccion).then((coordinates) => ({
          sucursal,
          coordinates,
        })),
      ),
    );

    const nearest = (target: { lat: number; lng: number }): ISucursalDocument => {
      let best = coords[0].sucursal;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const { sucursal, coordinates } of coords) {
        const distance = haversineKm(target, coordinates);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = sucursal;
        }
      }

      return best;
    };

    return [nearest(origenCoords)._id, nearest(destinoCoords)._id];
  }

  private async uniqueCodigo(): Promise<string> {
    for (let attempt = 0; attempt < MAX_CODIGO_ATTEMPTS; attempt += 1) {
      const codigo = generateCodigo();
      if (!(await this.shipments.existsByCodigo(codigo))) {
        return codigo;
      }
    }

    throw new ConflictException('No se pudo generar un código único para el envío');
  }
}

function requireClienteId(session: AuthenticatedUser): string {
  if (!session.clienteId) {
    throw new UnauthorizedException('La sesión no tiene un cliente asociado');
  }
  return session.clienteId;
}

function generateCodigo(): string {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += CODIGO_ALFABETO[randomInt(0, CODIGO_ALFABETO.length)];
  }
  return `EY-${code}`;
}

function generatePaqueteId(now: Date, index: number): string {
  const pad = (value: number, length = 2): string =>
    String(value).padStart(length, '0');
  const stamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}` +
    pad(now.getUTCMilliseconds(), 3);
  return `PAQ-${stamp}-${index}`;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
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

function toEvents(events: IEnvioDocument['ultimosEventos']): TrackingEventDto[] {
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

function toCosto(costo: ICostoEnvio): ICostoEnvio {
  return {
    flete: costo.flete,
    recargos: costo.recargos,
    seguro: costo.seguro,
    total: costo.total,
  };
}

export function toDetail(doc: EnvioConFlag): ShipmentDetailDto {
  return {
    codigo: doc.codigo,
    estado: doc.estado,
    cancelado: doc.cancelado === true,
    motivoCancelacion: doc.motivoCancelacion ?? null,
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
    ultimosEventos: toEvents(doc.ultimosEventos),
    totalEventos: doc.totalEventos ?? 0,
  };
}

export function toListItem(doc: EnvioConFlag): ShipmentListItemDto {
  return {
    codigo: doc.codigo,
    estado: doc.estado,
    cancelado: doc.cancelado === true,
    destinoCiudad: doc.destinatario?.direccion?.ciudad ?? '',
    fechaCreacion: requiredIso(doc.fechaCreacion, 'fechaCreacion'),
    totalPaquetes: doc.totalPaquetes,
    pesoTotalKg: doc.pesoTotalKg,
    total: doc.costo?.total ?? 0,
  };
}
