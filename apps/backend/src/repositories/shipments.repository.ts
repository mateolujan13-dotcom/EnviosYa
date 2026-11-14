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
}
