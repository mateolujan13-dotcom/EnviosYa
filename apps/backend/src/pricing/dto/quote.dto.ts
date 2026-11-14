import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ModalidadServicio } from '@envioya/shared';

export class QuoteDireccionDto {
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

export class QuoteRequestDto {
  @ValidateNested()
  @Type(() => QuoteDireccionDto)
  origen!: QuoteDireccionDto;

  @ValidateNested()
  @Type(() => QuoteDireccionDto)
  destino!: QuoteDireccionDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PaqueteDto)
  paquetes!: PaqueteDto[];

  @IsOptional()
  @IsEnum(ModalidadServicio)
  modalidad?: ModalidadServicio;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  sucursalOrigenId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  sucursalDestinoId?: string;
}
