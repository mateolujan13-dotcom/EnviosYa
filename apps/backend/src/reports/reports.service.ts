import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Collection, Filter } from 'mongodb';
import {
  IEnvioDocument,
  ReportsSummaryDto,
  ReporteSucursalDto,
  TiemposPromedioDto,
  TopRepartidorDto,
  ReporteEstadoDto,
} from '@envioya/shared';
import { MongoDatabaseService } from '../database/mongo-database.service';
import { ReportFiltersDto } from './dto/reports.dto';

const CSV_HEADER =
  'codigo,estado,cancelado,cliente,origenCiudad,destinoCiudad,totalPaquetes,pesoTotalKg,totalARS,fechaCreacion';

// Rango de offsets ISO 8601 válido: -14:00..+14:00.
const ISO_8601_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,3})?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)?)?$/;

const NO_CANCELADOS = { cancelado: { $ne: true } } as const;
const ESTADO_ENTREGADO = 'entregado';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const round1 = (n: number): number => Math.round((n + Number.EPSILON) * 10) / 10;

function parseIsoDateParam(
  value: string | undefined,
  field: 'from' | 'to',
): Date | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;

  const match = ISO_8601_PATTERN.exec(trimmed);
  if (!match) {
    throw new BadRequestException(
      `${field} inválido: se esperaba una fecha ISO 8601 (ej. 2026-11-01 o 2026-11-01T00:00:00.000Z)`,
    );
  }

  // Round-trip de día/mes/año: rechaza calendarios imposibles (p. ej. 2026-02-30).
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const roundTrip = new Date(Date.UTC(year, month - 1, day));
  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== month - 1 ||
    roundTrip.getUTCDate() !== day
  ) {
    throw new BadRequestException(`${field} inválido: ese día no existe en el mes`);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${field} inválido: la fecha no se puede interpretar`);
  }
  return parsed;
}

/** RFC 4180: newline→espacio, trim, guard anti-inyección (= + - @ → prefijo '), quotes duplicadas. */
function csvCell(raw: unknown): string {
  const sanitized = String(raw ?? '')
    .replace(/[\r\n]+/g, ' ')
    .trim();
  const guarded = /^[=+\-@]/.test(sanitized) ? `'${sanitized}` : sanitized;
  if (/[",]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

function isoOrEmpty(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return '';
}

function csvTimestamp(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`
  );
}

interface EnvioCsvRow {
  codigo?: string;
  estado?: string;
  cancelado?: boolean;
  clienteResumen?: { nombre?: string };
  remitente?: { direccion?: { ciudad?: string } };
  destinatario?: { direccion?: { ciudad?: string } };
  totalPaquetes?: number;
  pesoTotalKg?: number;
  costo?: { total?: number };
  fechaCreacion?: Date | string;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly mongo: MongoDatabaseService) {}

  private get envios(): Collection<IEnvioDocument> {
    return this.mongo.getDb().collection<IEnvioDocument>('envios');
  }

  /**
   * Filtro común de reportes (S2): `fechaCreacion` ∈ [from, to] (ambos inclusive
   * si vienen) y, si hay `sucursalId`, match OR origen/destino. Excluye nada más;
   * cada query suma sus propios predicados de negocio.
   */
  buildMatch(filters: ReportFiltersDto): Record<string, unknown> {
    const match: Record<string, unknown> = {};

    const fechaCreacion: Record<string, Date> = {};
    const from = parseIsoDateParam(filters.from, 'from');
    const to = parseIsoDateParam(filters.to, 'to');
    if (from) fechaCreacion.$gte = from;
    if (to) fechaCreacion.$lte = to;
    if (Object.keys(fechaCreacion).length > 0) {
      match.fechaCreacion = fechaCreacion;
    }

    if (filters.sucursalId) {
      match.$or = [
        { sucursalOrigenId: filters.sucursalId },
        { sucursalDestinoId: filters.sucursalId },
      ];
    }

    return match;
  }

  async resumen(filters: ReportFiltersDto): Promise<ReportsSummaryDto> {
    const match = this.buildMatch(filters);
    const countEstado = (estado: string) => ({
      $cond: [
        { $and: [{ $eq: ['$estado', estado] }, { $ne: ['$cancelado', true] }] },
        1,
        0,
      ],
    });

    const [row] = await this.envios
      .aggregate<{
        totalEnvios?: number;
        cancelados?: number;
        noCancelados?: number;
        entregados?: number;
        enTransito?: number;
        enReparto?: number;
        enSucursal?: number;
        conIncidencia?: number;
        devueltos?: number;
        gastoTotal?: number;
      }>([
        { $match: match },
        {
          $group: {
            _id: null,
            // totalEnvios incluye cancelados; el resto excluye cancelado:true.
            totalEnvios: { $sum: 1 },
            cancelados: {
              $sum: { $cond: [{ $eq: ['$cancelado', true] }, 1, 0] },
            },
            noCancelados: {
              $sum: { $cond: [{ $eq: ['$cancelado', true] }, 0, 1] },
            },
            entregados: { $sum: countEstado(ESTADO_ENTREGADO) },
            enTransito: { $sum: countEstado('en_transito') },
            enReparto: { $sum: countEstado('en_reparto') },
            enSucursal: { $sum: countEstado('en_sucursal') },
            conIncidencia: { $sum: countEstado('con_incidencia') },
            devueltos: { $sum: countEstado('devuelto') },
            gastoTotal: {
              $sum: {
                $cond: [
                  { $eq: ['$cancelado', true] },
                  0,
                  { $ifNull: ['$costo.total', 0] },
                ],
              },
            },
          },
        },
      ])
      .toArray();

    const totalEnvios = row?.totalEnvios ?? 0;
    const cancelados = row?.cancelados ?? 0;
    const noCancelados = row?.noCancelados ?? 0;
    const entregados = row?.entregados ?? 0;
    const gastoTotal = round2(row?.gastoTotal ?? 0);
    const tasaEntrega =
      totalEnvios === 0 ? 0 : round2((entregados / totalEnvios) * 100);
    const ticketPromedio =
      noCancelados === 0 ? 0 : round2(gastoTotal / noCancelados);

    return {
      totalEnvios,
      entregados,
      enTransito: row?.enTransito ?? 0,
      enReparto: row?.enReparto ?? 0,
      enSucursal: row?.enSucursal ?? 0,
      conIncidencia: row?.conIncidencia ?? 0,
      devueltos: row?.devueltos ?? 0,
      cancelados,
      tasaEntrega,
      gastoTotal,
      ticketPromedio,
    };
  }

  async porSucursal(filters: ReportFiltersDto): Promise<ReporteSucursalDto[]> {
    // Envíos por sucursal DESTINO (A2); excluye cancelados (métricas de negocio).
    const match = { ...this.buildMatch(filters), ...NO_CANCELADOS };

    const rows = await this.envios
      .aggregate<{
        _id?: string | null;
        cantidad?: number;
        entregados?: number;
        totalARS?: number;
        sucursal?: Array<{ nombre?: string }>;
      }>([
        { $match: match },
        {
          $group: {
            _id: '$sucursalDestinoId',
            cantidad: { $sum: 1 },
            entregados: {
              $sum: { $cond: [{ $eq: ['$estado', ESTADO_ENTREGADO] }, 1, 0] },
            },
            totalARS: { $sum: { $ifNull: ['$costo.total', 0] } },
          },
        },
        { $sort: { cantidad: -1, _id: 1 } },
        {
          $lookup: {
            from: 'sucursales',
            localField: '_id',
            foreignField: '_id',
            as: 'sucursal',
          },
        },
      ])
      .toArray();

    return rows
      .filter((row) => Boolean(row._id))
      .map((row) => ({
        sucursalId: String(row._id),
        nombre: row.sucursal?.[0]?.nombre ?? String(row._id),
        cantidad: row.cantidad ?? 0,
        entregados: row.entregados ?? 0,
        totalARS: round2(row.totalARS ?? 0),
      }));
  }

  async tiemposPromedio(filters: ReportFiltersDto): Promise<TiemposPromedioDto> {
    // Solo entregados completos (A1): estado entregado + fechaEntrega presente,
    // sin cancelados. promedio = avg(fechaEntrega − fechaCreacion) en ms → horas.
    const match = {
      ...this.buildMatch(filters),
      ...NO_CANCELADOS,
      estado: ESTADO_ENTREGADO,
      fechaEntrega: { $ne: null },
    };

    const [result] = await this.envios
      .aggregate<{
        global?: Array<{ promedioMs?: number | null }>;
        porSucursal?: Array<{
          _id?: string | null;
          promedioMs?: number | null;
          entregados?: number;
          sucursal?: Array<{ nombre?: string }>;
        }>;
      }>([
        { $match: match },
        {
          $facet: {
            global: [
              {
                $group: {
                  _id: null,
                  promedioMs: {
                    $avg: { $subtract: ['$fechaEntrega', '$fechaCreacion'] },
                  },
                },
              },
            ],
            porSucursal: [
              {
                $group: {
                  _id: '$sucursalDestinoId',
                  promedioMs: {
                    $avg: { $subtract: ['$fechaEntrega', '$fechaCreacion'] },
                  },
                  entregados: { $sum: 1 },
                },
              },
              { $sort: { entregados: -1, _id: 1 } },
              {
                $lookup: {
                  from: 'sucursales',
                  localField: '_id',
                  foreignField: '_id',
                  as: 'sucursal',
                },
              },
            ],
          },
        },
      ])
      .toArray();

    const globalRow = result?.global?.[0];
    const promedioHoras =
      typeof globalRow?.promedioMs === 'number'
        ? round1(globalRow.promedioMs / 3600000)
        : 0;

    const porSucursal = (result?.porSucursal ?? [])
      .filter((row) => Boolean(row._id))
      .map((row) => ({
        sucursalId: String(row._id),
        nombre: row.sucursal?.[0]?.nombre ?? String(row._id),
        promedioHoras:
          typeof row.promedioMs === 'number' ? round1(row.promedioMs / 3600000) : 0,
        entregados: row.entregados ?? 0,
      }));

    return { promedioHoras, porSucursal };
  }

  async topRepartidores(filters: ReportFiltersDto): Promise<TopRepartidorDto[]> {
    // Top 5 por entregas (estado entregado, sin cancelados). Los paquetes, el
    // peso y el monto se suman sobre ese mismo universo de entregas completadas.
    const match = {
      ...this.buildMatch(filters),
      ...NO_CANCELADOS,
      estado: ESTADO_ENTREGADO,
      repartidorId: { $ne: null },
    };

    const rows = await this.envios
      .aggregate<{
        _id?: string | null;
        entregas?: number;
        totalPaquetes?: number;
        pesoTotalKg?: number;
        totalARS?: number;
        repartidor?: Array<{ nombre?: string }>;
      }>([
        { $match: match },
        {
          $group: {
            _id: '$repartidorId',
            entregas: { $sum: 1 },
            totalPaquetes: { $sum: { $ifNull: ['$totalPaquetes', 0] } },
            pesoTotalKg: { $sum: { $ifNull: ['$pesoTotalKg', 0] } },
            totalARS: { $sum: { $ifNull: ['$costo.total', 0] } },
          },
        },
        { $sort: { entregas: -1, _id: 1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'repartidores',
            localField: '_id',
            foreignField: '_id',
            as: 'repartidor',
          },
        },
      ])
      .toArray();

    return rows
      .filter((row) => Boolean(row._id))
      .map((row) => ({
        repartidorId: String(row._id),
        nombre: row.repartidor?.[0]?.nombre ?? String(row._id),
        entregas: row.entregas ?? 0,
        totalPaquetes: row.totalPaquetes ?? 0,
        pesoTotalKg: round2(row.pesoTotalKg ?? 0),
        totalARS: round2(row.totalARS ?? 0),
      }));
  }

  async porEstado(filters: ReportFiltersDto): Promise<ReporteEstadoDto[]> {
    // Todos los estados presentes (excepto cancelados:true); un estado ausente
    // simplemente no aparece en el array.
    const match = { ...this.buildMatch(filters), ...NO_CANCELADOS };

    const rows = await this.envios
      .aggregate<{ _id?: string | null; cantidad?: number }>([
        { $match: match },
        { $group: { _id: '$estado', cantidad: { $sum: 1 } } },
        { $sort: { cantidad: -1, _id: 1 } },
      ])
      .toArray();

    return rows
      .filter((row) => Boolean(row._id))
      .map((row) => ({ estado: String(row._id), cantidad: row.cantidad ?? 0 }));
  }

  /**
   * Exporta a CSV en streaming (S2/S4): cursor con batchSize 200 + res.write por
   * fila; nunca materializa el array completo. Sin Content-Length (chunked).
   * A diferencia de los KPIs, el CSV NO excluye cancelados: es un volcado crudo
   * con la columna `cancelado`.
   */
  async streamEnviosCsv(
    filters: ReportFiltersDto,
    res: Response,
  ): Promise<void> {
    const match = this.buildMatch(filters);
    const stamp = csvTimestamp(new Date());

    res.status(200);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="envios-${stamp}.csv"`,
    );
    res.write(`\uFEFF${CSV_HEADER}\r\n`);

    const cursor = this.envios
      .find(match as Filter<IEnvioDocument>, {
        projection: {
          _id: 0,
          codigo: 1,
          estado: 1,
          cancelado: 1,
          'clienteResumen.nombre': 1,
          'remitente.direccion.ciudad': 1,
          'destinatario.direccion.ciudad': 1,
          totalPaquetes: 1,
          pesoTotalKg: 1,
          'costo.total': 1,
          fechaCreacion: 1,
        },
      })
      .batchSize(200)
      .stream();

    let streamed = 0;

    cursor.on('data', (doc: EnvioCsvRow) => {
      streamed += 1;
      const line = enviosCsvLine(doc);
      // Respeta backpressure: pausa el cursor si el socket está saturado.
      if (!res.write(line)) {
        cursor.pause();
        res.once('drain', () => cursor.resume());
      }
    });

    cursor.on('error', (error: Error) => {
      this.logger.error(
        `Error generando CSV tras ${streamed} filas: ${error.message}`,
      );
      if (!res.writableEnded) res.end();
    });

    cursor.on('end', () => {
      if (!res.writableEnded) res.end();
    });
  }
}

function enviosCsvLine(doc: EnvioCsvRow): string {
  const cells = [
    doc.codigo ?? '',
    doc.estado ?? '',
    doc.cancelado === true ? 'true' : 'false',
    doc.clienteResumen?.nombre ?? '',
    doc.remitente?.direccion?.ciudad ?? '',
    doc.destinatario?.direccion?.ciudad ?? '',
    String(doc.totalPaquetes ?? 0),
    String(round2(Number(doc.pesoTotalKg ?? 0))),
    String(round2(Number(doc.costo?.total ?? 0))),
    isoOrEmpty(doc.fechaCreacion),
  ];

  return `${cells.map(csvCell).join(',')}\r\n`;
}
