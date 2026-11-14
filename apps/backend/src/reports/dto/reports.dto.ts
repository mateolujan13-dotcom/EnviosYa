import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Filtros comunes de reportes operativos (S2).
 * `from`/`to` son cadenas ISO 8601 (fecha o fecha-hora con zona).
 * `sucursalId` matchea `sucursalOrigenId` o `sucursalDestinoId`.
 * El formato inválido de `from`/`to` lo rechaza el servicio con 400.
 * Se declara acá (y no en el handler) para que el ValidationPipe global
 * (whitelist + forbidNonWhitelisted) deje pasar exactamente estos params.
 */
export class ReportFiltersDto {
  /** Fecha ISO 8601. Inclusive sobre `fechaCreacion` ($gte). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  from?: string;

  /** Fecha ISO 8601. Inclusive sobre `fechaCreacion` ($lte). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  to?: string;

  /** Match OR sobre `sucursalOrigenId` / `sucursalDestinoId`. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  sucursalId?: string;
}
