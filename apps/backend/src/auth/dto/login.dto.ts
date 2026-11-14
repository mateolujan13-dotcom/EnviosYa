import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class LoginRequestDto {
  @IsEmail({}, { message: 'Ingresá un email válido' })
  @MaxLength(120)
  email!: string;

  @IsString()
  @MaxLength(72)
  password!: string;

  @IsOptional()
  @IsBoolean()
  recordarme?: boolean;
}
