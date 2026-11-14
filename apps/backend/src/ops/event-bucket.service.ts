import { Injectable } from '@nestjs/common';
import { UpdateFilter } from 'mongodb';
import { MongoDatabaseService } from '../database/mongo-database.service';

/** Evento inmutable con el shape exacto que exige el validator TP9 (07_envios_eventos.js). */
export interface BucketEvent {
  tipo: string;
  estado: string;
  timestamp: Date;
  sucursalId: string | null;
  repartidorId: string | null;
  ubicacion: null;
  observacion: string | null;
}

interface BucketDoc {
  _id: string;
  envioId: string;
  fechaDia: Date;
  cantidadEventos: number;
  eventos: BucketEvent[];
}

/**
 * Upsert del bucket del día en `eventos_seguimiento`
 * (`_id = EVB-<envioId>-<YYYY-MM-DD>`, fecha UTC). Sin transacción (Mongo
 * standalone): el envío se actualiza primero y el bucket después (A3 del PR #7).
 */
@Injectable()
export class EventBucketService {
  constructor(private readonly mongo: MongoDatabaseService) {}

  private get col() {
    return this.mongo.getDb().collection<BucketDoc>('eventos_seguimiento');
  }

  async append(
    envioId: string,
    event: BucketEvent,
    now: Date = new Date(),
  ): Promise<void> {
    const day = now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    const bucketId = `EVB-${envioId}-${day}`;
    const fechaDia = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    await this.col.updateOne(
      { _id: bucketId },
      {
        $push: { eventos: event },
        $inc: { cantidadEventos: 1 },
        $setOnInsert: { envioId, fechaDia },
      } as UpdateFilter<BucketDoc>,
      { upsert: true },
    );
  }
}
