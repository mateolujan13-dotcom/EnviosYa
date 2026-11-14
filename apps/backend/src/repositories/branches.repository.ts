import { Injectable } from '@nestjs/common';
import { Filter, UpdateFilter } from 'mongodb';
import { ISucursalDocument } from '@envioya/shared';
import { MongoDatabaseService } from '../database/mongo-database.service';

@Injectable()
export class BranchesRepository {
  constructor(private readonly mongo: MongoDatabaseService) {}

  private get col() {
    return this.mongo.getDb().collection<ISucursalDocument>('sucursales');
  }

  async findById(id: string): Promise<ISucursalDocument | null> {
    return this.col.findOne({ _id: id } as Filter<ISucursalDocument>);
  }

  async findAll(options: { soloActivas?: boolean } = {}): Promise<ISucursalDocument[]> {
    const filter: Filter<ISucursalDocument> = {};
    if (options.soloActivas) filter.activa = true;

    return this.col.find(filter).sort({ nombre: 1 }).toArray();
  }

  async findByCiudad(ciudad: string): Promise<ISucursalDocument[]> {
    return this.col
      .find({ 'direccion.ciudad': ciudad } as Filter<ISucursalDocument>)
      .sort({ nombre: 1 })
      .toArray();
  }

  async countByCiudad(): Promise<Record<string, number>> {
    const results = await this.col
      .aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$direccion.ciudad', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    return Object.fromEntries(results.map((result) => [result._id, result.count]));
  }

  async insertOne(doc: ISucursalDocument): Promise<ISucursalDocument> {
    await this.col.insertOne(doc);
    return doc;
  }

  async updateOne(
    id: string,
    update: UpdateFilter<ISucursalDocument>,
  ): Promise<boolean> {
    const result = await this.col.updateOne(
      { _id: id } as Filter<ISucursalDocument>,
      update,
    );
    return result.modifiedCount > 0;
  }
}
