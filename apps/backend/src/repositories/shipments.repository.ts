import { Injectable } from '@nestjs/common';
import { Collection, Filter, UpdateFilter } from 'mongodb';
import { IEnvioDocument } from '@envioya/shared';
import { MongoDatabaseService } from '../database/mongo-database.service';

@Injectable()
export class ShipmentsRepository {
  constructor(private readonly mongo: MongoDatabaseService) {}

  private get col(): Collection<IEnvioDocument> {
    return this.mongo.getDb().collection<IEnvioDocument>('envios');
  }

  async findById(id: string): Promise<IEnvioDocument | null> {
    return this.col.findOne({ _id: id } as Filter<IEnvioDocument>);
  }

  async findByCodigo(codigo: string): Promise<IEnvioDocument | null> {
    return this.col.findOne({ codigo } as Filter<IEnvioDocument>);
  }

  async findByClienteId(
    clienteId: string,
    page = 1,
    limit = 10,
    estado?: string,
  ): Promise<{ items: IEnvioDocument[]; total: number }> {
    const filter: Filter<IEnvioDocument> = { clienteId } as Filter<IEnvioDocument>;
    if (estado) (filter as Record<string, unknown>)['estado'] = estado;

    const [items, total] = await Promise.all([
      this.col
        .find(filter)
        .sort({ fechaCreacion: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      this.col.countDocuments(filter),
    ]);

    return { items, total };
  }

  async findAll(
    filter: Filter<IEnvioDocument> = {},
    page = 1,
    limit = 20,
  ): Promise<{ items: IEnvioDocument[]; total: number }> {
    const [items, total] = await Promise.all([
      this.col
        .find(filter)
        .sort({ fechaCreacion: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      this.col.countDocuments(filter),
    ]);

    return { items, total };
  }

  async countByEstado(): Promise<Record<string, number>> {
    const pipeline = [
      { $group: { _id: '$estado', count: { $sum: 1 } } },
    ];
    const results = await this.col.aggregate<{ _id: string; count: number }>(pipeline).toArray();
    return Object.fromEntries(results.map((r) => [r._id, r.count]));
  }

  async insertOne(doc: IEnvioDocument): Promise<IEnvioDocument> {
    await this.col.insertOne(doc as IEnvioDocument & { _id: string });
    return doc;
  }

  async updateOne(
    id: string,
    update: UpdateFilter<IEnvioDocument>,
  ): Promise<boolean> {
    const result = await this.col.updateOne(
      { _id: id } as Filter<IEnvioDocument>,
      update,
    );
    return result.modifiedCount > 0;
  }

  /**
   * Devuelve el `_id` máximo que empieza con `prefix` (p. ej. `ENV-2026-`),
   * o `null` si no existe ninguno. Solo el sufijo numérico importa: el
   * criterio de orden es lexicográfico de `_id`.
   */
  async findMaxIdByPrefix(prefix: string): Promise<string | null> {
    const doc = await this.col.findOne(
      { _id: { $regex: `^${escapeRegex(prefix)}` } } as Filter<IEnvioDocument>,
      { sort: { _id: -1 }, projection: { _id: 1 } },
    );
    return doc?._id ?? null;
  }

  async existsByCodigo(codigo: string): Promise<boolean> {
    const doc = await this.col.findOne(
      { codigo } as Filter<IEnvioDocument>,
      { projection: { _id: 1 } },
    );
    return doc !== null;
  }

  /**
   * Lista paginada de envíos propios con filtros opcionales por estado
   * (enum) y por flag plano `cancelado`. Sin filtro `cancelado` lista todos
   * los propios; `fechaCreacion desc`.
   */
  async findOwnPaged(
    clienteId: string,
    page: number,
    limit: number,
    estado?: string,
    cancelado?: boolean,
  ): Promise<{ items: IEnvioDocument[]; total: number }> {
    const filter: Record<string, unknown> = { clienteId };
    if (estado) filter['estado'] = estado;
    if (typeof cancelado === 'boolean') filter['cancelado'] = cancelado;

    const mongoFilter = filter as Filter<IEnvioDocument>;
    const [items, total] = await Promise.all([
      this.col
        .find(mongoFilter)
        .sort({ fechaCreacion: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      this.col.countDocuments(mongoFilter),
    ]);

    return { items, total };
  }

  /**
   * Resumen del portal del cliente. `activos` excluye cancelados y estados
   * fuera de la ventana operativa; `entregadosEsteMes` cuenta por
   * `fechaEntrega` en el mes UTC corriente; `gastoDelMes` suma `costo.total`
   * por `fechaCreacion` en el mes (sin cancelados); `totalEnvios` es el
   * total de propios.
   */
  async summaryForCliente(
    clienteId: string,
    startOfMonthUtc: Date,
  ): Promise<{
    activos: number;
    entregadosEsteMes: number;
    gastoDelMes: number;
    totalEnvios: number;
  }> {
    const noCancelado = { cancelado: { $ne: true } } as Record<string, unknown>;

    const [activos, entregadosEsteMes, totalEnvios, gasto] =
      await Promise.all([
        this.col.countDocuments({
          clienteId,
          ...noCancelado,
          estado: {
            $in: [
              'pendiente',
              'en_transito',
              'en_sucursal',
              'en_reparto',
              'con_incidencia',
            ],
          },
        } as Filter<IEnvioDocument>),
        this.col.countDocuments({
          clienteId,
          ...noCancelado,
          estado: 'entregado',
          fechaEntrega: { $gte: startOfMonthUtc },
        } as Filter<IEnvioDocument>),
        this.col.countDocuments({ clienteId } as Filter<IEnvioDocument>),
        this.col
          .aggregate<{ total: number }>([
            {
              $match: {
                clienteId,
                cancelado: { $ne: true },
                fechaCreacion: { $gte: startOfMonthUtc },
              },
            },
            { $group: { _id: null, total: { $sum: '$costo.total' } } },
          ])
          .toArray(),
      ]);

    return {
      activos,
      entregadosEsteMes,
      gastoDelMes: gasto[0]?.total ?? 0,
      totalEnvios,
    };
  }

  /**
   * Cancelación atómica del portal del cliente: solo si el envío sigue
   * pendiente, sin repartidor asignado y no cancelado. Escribe flag plano
   * `cancelado: true` + `motivoCancelacion`, agrega el evento a
   * `ultimosEventos` recortado a 5 (`$slice: -5`) e incrementa
   * `totalEventos`. Devuelve el documento actualizado o `null` si perdió la
   * carrera (el caller responde 409).
   */
  async applyCancellation(
    id: string,
    motivo: string,
    event: {
      tipo: string;
      estado: string;
      timestamp: Date;
      sucursalId: string | null;
      repartidorId: string | null;
      descripcion: string;
    },
  ): Promise<(IEnvioDocument & { cancelado?: boolean }) | null> {
    const updated = await this.col.findOneAndUpdate(
      {
        _id: id,
        estado: 'pendiente',
        repartidorId: null,
        cancelado: { $ne: true },
      } as unknown as Filter<IEnvioDocument>,
      {
        $set: { cancelado: true, motivoCancelacion: motivo },
        $push: { ultimosEventos: { $each: [event], $slice: -5 } },
        $inc: { totalEventos: 1 },
      } as unknown as UpdateFilter<IEnvioDocument>,
      { returnDocument: 'after' },
    );

    return (updated as (IEnvioDocument & { cancelado?: boolean }) | null) ?? null;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
