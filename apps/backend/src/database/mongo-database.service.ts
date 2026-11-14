import {
  Global,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Db, MongoClient } from 'mongodb';

@Global()
@Injectable()
export class MongoDatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MongoDatabaseService.name);
  private client: MongoClient;
  private db: Db;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const uri = this.config.getOrThrow<string>('MONGODB_URI');
    const dbName = this.config.getOrThrow<string>('MONGODB_DB_NAME');

    this.client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });

    await this.client.connect();
    this.db = this.client.db(dbName);
    this.logger.log(`Conectado a MongoDB: ${dbName}`);

    await this.ensureUsuariosCollection();
    await this.ensureTarifasCollection();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
    this.logger.log('Conexión MongoDB cerrada');
  }

  getDb(): Db {
    if (!this.db) {
      throw new Error(
        'MongoDB no está conectado. Verificá MONGODB_URI y que el servidor esté corriendo.',
      );
    }
    return this.db;
  }

  getClient(): MongoClient {
    return this.client;
  }

  /**
   * Crea la colección `usuarios` con su JSON Schema validator
   * si no existe aún. Idempotente: no falla si ya existe.
   */
  private async ensureUsuariosCollection(): Promise<void> {
    const collections = await this.db
      .listCollections({ name: 'usuarios' })
      .toArray();

    if (collections.length === 0) {
      await this.db.createCollection('usuarios', {
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['email', 'passwordHash', 'nombre', 'rol', 'activo'],
            properties: {
              _id: { bsonType: 'string' },
              email: {
                bsonType: 'string',
                pattern: '^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$',
              },
              passwordHash: { bsonType: 'string', minLength: 10 },
              nombre: { bsonType: 'string', minLength: 2 },
              rol: { enum: ['cliente', 'operador', 'admin'] },
              clienteId: { bsonType: ['string', 'null'] },
              activo: { bsonType: 'bool' },
              createdAt: { bsonType: 'date' },
              updatedAt: { bsonType: 'date' },
            },
          },
        },
        validationLevel: 'strict',
        validationAction: 'error',
      });

      this.logger.log('Colección `usuarios` creada con validator y índice único en email');
    } else {
      this.logger.log('Colección `usuarios` ya existe — sin cambios');
    }

    await this.db
      .collection('usuarios')
      .createIndex({ email: 1 }, { unique: true, name: 'idx_email_unique' });
  }

  /**
   * Crea la colección `tarifas` si no existe. El TP9 no trae tarifas:
   * es una extensión de la app para parametrizar la cotización (PR #5).
   */
  private async ensureTarifasCollection(): Promise<void> {
    const collections = await this.db
      .listCollections({ name: 'tarifas' })
      .toArray();

    if (collections.length === 0) {
      await this.db.createCollection('tarifas', {
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: [
              'nombre',
              'precioBase',
              'precioKm',
              'precioKg',
              'recargoFragilPorcentaje',
              'tasaSeguroPorcentaje',
              'alicuotaIva',
              'moneda',
              'vigenteDesde',
              'activa',
            ],
            properties: {
              _id: { bsonType: 'string' },
              nombre: { bsonType: 'string', minLength: 2 },
              precioBase: { bsonType: ['double', 'int'], minimum: 0 },
              precioKm: { bsonType: ['double', 'int'], minimum: 0 },
              precioKg: { bsonType: ['double', 'int'], minimum: 0 },
              recargoFragilPorcentaje: { bsonType: ['double', 'int'], minimum: 0 },
              tasaSeguroPorcentaje: { bsonType: ['double', 'int'], minimum: 0 },
              alicuotaIva: { bsonType: ['double', 'int'], minimum: 0 },
              moneda: { bsonType: 'string', minLength: 3 },
              vigenteDesde: { bsonType: 'date' },
              activa: { bsonType: 'bool' },
              schemaVersion: { bsonType: 'int' },
            },
          },
        },
        validationLevel: 'strict',
        validationAction: 'error',
      });

      this.logger.log('Colección `tarifas` creada con validator');
    } else {
      this.logger.log('Colección `tarifas` ya existe — sin cambios');
    }

    await this.db
      .collection('tarifas')
      .createIndex(
        { activa: 1, vigenteDesde: -1 },
        { name: 'ix_tarifas_activa_vigencia' },
      );
  }
}
