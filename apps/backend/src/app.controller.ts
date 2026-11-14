import { Controller, Get } from '@nestjs/common';
import { MongoDatabaseService } from './database/mongo-database.service';

@Controller('health')
export class AppController {
  constructor(private readonly mongo: MongoDatabaseService) {}

  @Get()
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'EnvioYa API',
    };
  }

  @Get('db')
  async getDatabaseHealth() {
    const db = this.mongo.getDb();
    await db.command({ ping: 1 });

    const collectionNames = (await db.listCollections().toArray())
      .map((collection) => collection.name)
      .sort();

    const counts: Record<string, number> = {};
    for (const name of collectionNames) {
      counts[name] = await db.collection(name).estimatedDocumentCount();
    }

    return {
      status: 'ok',
      database: db.databaseName,
      collections: counts,
      timestamp: new Date().toISOString(),
    };
  }
}
