import { Injectable } from '@nestjs/common';
import { Filter, UpdateFilter } from 'mongodb';
import { IRepartidorDocument, IVehiculoDocument } from '@envioya/shared';
import { MongoDatabaseService } from '../database/mongo-database.service';

export interface VehicleFilters {
  sucursalId?: string;
  estado?: string;
  tipo?: string;
}

export interface DriverFilters {
  sucursalId?: string;
  estado?: string;
}

@Injectable()
export class FleetRepository {
  constructor(private readonly mongo: MongoDatabaseService) {}

  private get vehiculos() {
    return this.mongo.getDb().collection<IVehiculoDocument>('vehiculos');
  }

  private get repartidores() {
    return this.mongo.getDb().collection<IRepartidorDocument>('repartidores');
  }

  async findVehiculoById(id: string): Promise<IVehiculoDocument | null> {
    return this.vehiculos.findOne({ _id: id } as Filter<IVehiculoDocument>);
  }

  async findVehiculos(filters: VehicleFilters = {}): Promise<IVehiculoDocument[]> {
    const filter: Record<string, unknown> = {};
    if (filters.sucursalId) filter.sucursalId = filters.sucursalId;
    if (filters.estado) filter.estado = filters.estado;
    if (filters.tipo) filter.tipo = filters.tipo;

    return this.vehiculos
      .find(filter as Filter<IVehiculoDocument>)
      .sort({ patente: 1 })
      .toArray();
  }

  async findVehiculosDisponibles(
    sucursalId?: string,
    pesoRequeridoKg = 0,
  ): Promise<IVehiculoDocument[]> {
    const filter: Record<string, unknown> = {
      estado: { $in: ['operativo', 'disponible'] },
      capacidadKg: { $gte: pesoRequeridoKg },
    };
    if (sucursalId) filter.sucursalId = sucursalId;

    return this.vehiculos
      .find(filter as Filter<IVehiculoDocument>)
      .sort({ capacidadKg: 1 })
      .toArray();
  }

  async findRepartidorById(id: string): Promise<IRepartidorDocument | null> {
    return this.repartidores.findOne({
      _id: id,
    } as Filter<IRepartidorDocument>);
  }

  async findRepartidores(
    filters: DriverFilters = {},
  ): Promise<IRepartidorDocument[]> {
    const filter: Record<string, unknown> = {};
    if (filters.sucursalId) filter.sucursalBaseId = filters.sucursalId;
    if (filters.estado) filter.estado = filters.estado;

    return this.repartidores
      .find(filter as Filter<IRepartidorDocument>)
      .sort({ nombre: 1 })
      .toArray();
  }

  async findRepartidoresDisponibles(
    sucursalId?: string,
  ): Promise<IRepartidorDocument[]> {
    return this.findRepartidores({ sucursalId, estado: 'disponible' });
  }

  async insertVehiculo(doc: IVehiculoDocument): Promise<IVehiculoDocument> {
    await this.vehiculos.insertOne(doc);
    return doc;
  }

  async insertRepartidor(doc: IRepartidorDocument): Promise<IRepartidorDocument> {
    await this.repartidores.insertOne(doc);
    return doc;
  }

  async updateVehiculo(
    id: string,
    update: UpdateFilter<IVehiculoDocument>,
  ): Promise<boolean> {
    const result = await this.vehiculos.updateOne(
      { _id: id } as Filter<IVehiculoDocument>,
      update,
    );
    return result.modifiedCount > 0;
  }

  async updateRepartidor(
    id: string,
    update: UpdateFilter<IRepartidorDocument>,
  ): Promise<boolean> {
    const result = await this.repartidores.updateOne(
      { _id: id } as Filter<IRepartidorDocument>,
      update,
    );
    return result.modifiedCount > 0;
  }
}
