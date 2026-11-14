import { Type, Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const OPS_ESTADOS = [
  'pendiente',
  'en_transito',
  'en_sucursal',
  'en_reparto',
  'entregado',
  'con_incidencia',
  'devuelto',
] as const;

export class OpsShipmentsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsIn(OPS_ESTADOS as unknown as string[])
  estado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  sucursalId?: string;

  /** Búsqueda parcial case-insensitive sobre `codigo`. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  q?: string;
}

export class AssignResourcesDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  repartidorId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  vehiculoId!: string;
}

export class IncidentDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  observacion!: string;
}

export class ResolveIncidentDto {
  @IsIn(['en_sucursal', 'en_reparto', 'devuelto'])
  resolucion!: 'en_sucursal' | 'en_reparto' | 'devuelto';

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  observacion?: string;
}
