import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  IEnvioDocument,
  IEventoSeguimiento,
  ISucursalDocument,
  PublicTrackingDto,
  TrackingCityDto,
  TrackingEventDto,
} from '@envioya/shared';
import { BranchesRepository } from '../repositories/branches.repository';
import { ShipmentsRepository } from '../repositories/shipments.repository';
import { TRACKING_INVALID_CODE_MESSAGE } from './tracking.constants';

@Injectable()
export class ShipmentsTrackingService {
  constructor(
    private readonly shipments: ShipmentsRepository,
    private readonly branches: BranchesRepository,
  ) {}

  async trackByCode(codigo: string): Promise<PublicTrackingDto> {
    const envio = await this.shipments.findByCodigo(codigo);
    if (!envio) {
      throw new NotFoundException(TRACKING_INVALID_CODE_MESSAGE);
    }

    const [sucursalOrigen, sucursalDestino] = await Promise.all([
      this.branches.findById(envio.sucursalOrigenId),
      this.branches.findById(envio.sucursalDestinoId),
    ]);

    const fechaCreacion = toIsoStringOrNull(envio.fechaCreacion);
    if (!fechaCreacion) {
      throw new InternalServerErrorException(
        'El envío no tiene una fechaCreacion válida',
      );
    }

    return {
      codigo: envio.codigo,
      estado: envio.estado,
      origen: toPublicCity(sucursalOrigen),
      destino: toPublicCity(sucursalDestino),
      totalPaquetes: envio.totalPaquetes,
      pesoTotalKg: envio.pesoTotalKg,
      totalEventos: envio.totalEventos ?? 0,
      fechaCreacion,
      fechaDespacho: toIsoStringOrNull(envio.fechaDespacho),
      fechaEntregaEstimada: toIsoStringOrNull(envio.fechaEntregaEstimada),
      fechaEntrega: toIsoStringOrNull(envio.fechaEntrega),
      ultimosEventos: toPublicEvents(envio.ultimosEventos),
    };
  }
}

function toPublicCity(sucursal: ISucursalDocument | null): TrackingCityDto {
  return {
    ciudad: sucursal?.direccion?.ciudad ?? '',
    provincia: sucursal?.direccion?.provincia ?? '',
  };
}

function toIsoStringOrNull(value?: Date | string | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toPublicEvents(
  events: IEnvioDocument['ultimosEventos'],
): TrackingEventDto[] {
  return (events ?? [])
    .map((event: IEventoSeguimiento): TrackingEventDto => {
      const mapped: TrackingEventDto = {
        tipo: event.tipo,
        estado: event.estado,
        timestamp: new Date(event.timestamp).toISOString(),
        ...(event.descripcion !== undefined
          ? { descripcion: event.descripcion }
          : {}),
      };
      return mapped;
    })
    .sort(
      (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
    )
    .slice(0, 5)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}
