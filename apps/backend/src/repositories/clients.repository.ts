import { Injectable } from '@nestjs/common';
import { Filter, UpdateFilter } from 'mongodb';
import { IClienteDocument } from '@envioya/shared';
import { MongoDatabaseService } from '../database/mongo-database.service';

export interface ClientFilters {
  search?: string;
  tipo?: string;
  activo?: boolean;
  page?: number;
  limit?: number;
}

@Injectable()
export class ClientsRepository {
  constructor(private readonly mongo: MongoDatabaseService) {}

  private get col() {
    return this.mongo.getDb().collection<IClienteDocument>('clientes');
  }

  async findById(id: string): Promise<IClienteDocument | null> {
    return this.col.findOne({ _id: id } as Filter<IClienteDocument>);
  }

  async findByEmail(email: string): Promise<IClienteDocument | null> {
    return this.col.findOne({
      'contacto.email': email.toLowerCase(),
    } as Filter<IClienteDocument>);
  }

  async findAll(filters: ClientFilters = {}): Promise<{
    items: IClienteDocument[];
    total: number;
  }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const filter: Record<string, unknown> = {};

    if (filters.tipo) filter.tipo = filters.tipo;
    if (typeof filters.activo === 'boolean') filter.activo = filters.activo;

    if (filters.search?.trim()) {
      const regex = new RegExp(escapeRegExp(filters.search.trim()), 'i');
      filter.$or = [
        { razonSocial: regex },
        { cuit: regex },
        { 'contacto.nombre': regex },
        { 'contacto.email': regex },
      ];
    }

    const mongoFilter = filter as Filter<IClienteDocument>;
    const [items, total] = await Promise.all([
      this.col
        .find(mongoFilter)
        .sort({ razonSocial: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      this.col.countDocuments(mongoFilter),
    ]);

    return { items, total };
  }

  async countByTipo(): Promise<Record<string, number>> {
    const results = await this.col
      .aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$tipo', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    return Object.fromEntries(results.map((result) => [result._id, result.count]));
  }

  async insertOne(doc: IClienteDocument): Promise<IClienteDocument> {
    await this.col.insertOne(doc);
    return doc;
  }

  async updateOne(
    id: string,
    update: UpdateFilter<IClienteDocument>,
  ): Promise<boolean> {
    const result = await this.col.updateOne(
      { _id: id } as Filter<IClienteDocument>,
      update,
    );
    return result.modifiedCount > 0;
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.col.deleteOne({
      _id: id,
    } as Filter<IClienteDocument>);
    return result.deletedCount > 0;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
