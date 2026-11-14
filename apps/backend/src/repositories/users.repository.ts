import { Injectable } from '@nestjs/common';
import { Filter, UpdateFilter } from 'mongodb';
import { IUsuarioDocument } from '@envioya/shared';
import { MongoDatabaseService } from '../database/mongo-database.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly mongo: MongoDatabaseService) {}

  private get col() {
    return this.mongo.getDb().collection<IUsuarioDocument>('usuarios');
  }

  async findById(id: string): Promise<IUsuarioDocument | null> {
    return this.col.findOne({ _id: id } as Filter<IUsuarioDocument>);
  }

  async findByEmail(email: string): Promise<IUsuarioDocument | null> {
    return this.col.findOne({
      email: email.toLowerCase(),
    } as Filter<IUsuarioDocument>);
  }

  async insertOne(doc: IUsuarioDocument): Promise<IUsuarioDocument> {
    const now = new Date();
    const usuario: IUsuarioDocument = {
      ...doc,
      email: doc.email.toLowerCase(),
      createdAt: doc.createdAt ?? now,
      updatedAt: doc.updatedAt ?? now,
    };

    await this.col.insertOne(usuario);
    return usuario;
  }

  async updateOne(
    id: string,
    update: UpdateFilter<IUsuarioDocument>,
  ): Promise<boolean> {
    const result = await this.col.updateOne(
      { _id: id } as Filter<IUsuarioDocument>,
      { ...update, $set: { ...(update.$set ?? {}), updatedAt: new Date() } },
    );
    return result.modifiedCount > 0;
  }
}
