import { TipoCliente } from '@envioya/shared';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterRequestDto {
  @IsString()
  @Length(2, 80, { message: 'El nombre debe tener entre 2 y 80 caracteres' })
  nombre!: string;

  @IsEmail({}, { message: 'Ingresá un email válido' })
  @MaxLength(120)
  email!: string;

  @IsString()
  @Matches(/^[0-9+()\s-]{6,25}$/, {
    message: 'Ingresá un teléfono válido (solo números, espacios, +, - y paréntesis)',
  })
  telefono!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contraseña no puede superar los 72 caracteres' })
  @Matches(/^(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'La contraseña debe incluir al menos una mayúscula y un número',
  })
  password!: string;

  @IsOptional()
  @IsEnum(TipoCliente, { message: 'El tipo de cliente no es válido' })
  tipoCliente?: TipoCliente;
}
