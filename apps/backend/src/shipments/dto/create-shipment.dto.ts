import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ModalidadServicio } from '@envioya/shared';

export class DireccionDto {
  @IsString()
  @MaxLength(120)
  calle!: string;

  @Type(() => String)
  @IsString()
  @MaxLength(20)
  numero!: string;

  @IsString()
  @MaxLength(60)
  ciudad!: string;

  @IsString()
  @MaxLength(60)
  provincia!: string;

  @Type(() => String)
  @IsString()
  @MaxLength(10)
  cp!: string;
}

export class DestinatarioDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(30)
  telefono!: string;
}

export class PaqueteCaracteristicaDto {
  @IsString()
  @MaxLength(60)
  k!: string;

  @IsDefined()
  v!: string | number | boolean;
}

export class PaqueteDimensionesDto {
  @IsNumber({ allowNaN: false })
  @Min(0.5)
  @Max(500)
  altoCm!: number;

  @IsNumber({ allowNaN: false })
  @Min(0.5)
  @Max(500)
  anchoCm!: number;

  @IsNumber({ allowNaN: false })
  @Min(0.5)
  @Max(500)
  profundoCm!: number;
}

export class PaqueteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  descripcion!: string;

  @IsNumber({ allowNaN: false })
  @Min(0.01)
  @Max(10000)
  pesoKg!: number;

  @ValidateNested()
  @Type(() => PaqueteDimensionesDto)
  dimensiones!: PaqueteDimensionesDto;

  @IsBoolean()
  fragil!: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PaqueteCaracteristicaDto)
  caracteristicas?: PaqueteCaracteristicaDto[];
}

/**
 * Crea un envío desde el portal del cliente. El backend recalcula el costo
 * server-side (nunca confía en precios del cliente) y asigna las sucursales
 * más cercanas a origen/destino. `sucursalOrigenId`/`sucursalDestinoId` NO
 * se aceptan: con forbidNonWhitelisted su presencia responde 400.
 */
export class CreateShipmentDto {
  @ValidateNested()
  @Type(() => DireccionDto)
  origen!: DireccionDto;

  @ValidateNested()
  @Type(() => DireccionDto)
  destino!: DireccionDto;

  @ValidateNested()
  @Type(() => DestinatarioDto)
  destinatario!: DestinatarioDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PaqueteDto)
  paquetes!: PaqueteDto[];

  @IsOptional()
  @IsEnum(ModalidadServicio)
  modalidad?: ModalidadServicio;
}

export class CancelShipmentDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  motivo!: string;
}

const ESTADOS_FILTRABLES = [
  'pendiente',
  'en_transito',
  'en_sucursal',
  'en_reparto',
  'entregado',
  'con_incidencia',
  'devuelto',
] as const;

export class ShipmentsQueryDto {
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
  @IsIn(ESTADOS_FILTRABLES)
  estado?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  cancelados?: string;
}
