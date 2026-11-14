import { Injectable } from '@nestjs/common';
import { Filter, UpdateFilter } from 'mongodb';
import { ITarifaDocument } from '@envioya/shared';
import { MongoDatabaseService } from '../database/mongo-database.service';

@Injectable()
export class PricingRepository {
  constructor(private readonly mongo: MongoDatabaseService) {}

  private get col() {
    return this.mongo.getDb().collection<ITarifaDocument>('tarifas');
  }

  /**
   * Devuelve la tarifa activa más reciente a la fecha indicada.
   * El TP9 no incluye una colección `tarifas`; se agrega como extensión
   * de la app (igual que `usuarios`) para parametrizar la cotización.
   */
  async findActiva(at: Date = new Date()): Promise<ITarifaDocument | null> {
    return this.col.findOne(
      {
        activa: true,
        vigenteDesde: { $lte: at },
      } as Filter<ITarifaDocument>,
      { sort: { vigenteDesde: -1 } },
    );
  }

  async findAll(): Promise<ITarifaDocument[]> {
    return this.col.find().sort({ vigenteDesde: -1 }).toArray();
  }

  async insertOne(doc: ITarifaDocument): Promise<ITarifaDocument> {
    await this.col.insertOne(doc);
    return doc;
  }

  async updateOne(
    id: string,
    update: UpdateFilter<ITarifaDocument>,
  ): Promise<boolean> {
    const result = await this.col.updateOne(
      { _id: id } as Filter<ITarifaDocument>,
      update,
    );
    return result.modifiedCount > 0;
  }
}
