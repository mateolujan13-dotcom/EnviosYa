import { AuthResponseDto, RolUsuario } from '@envioya/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CookieOptions, Response } from 'express';
import { AuthService } from './auth.service';
import {
  REMEMBER_MAX_AGE_MS,
  SESSION_COOKIE_NAME,
} from './auth.constants';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { LoginRequestDto } from './dto/login.dto';
import { RegisterRequestDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AuthenticatedUser } from './interfaces/authenticated-user.interface';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  async register(
    @Body() dto: RegisterRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const session = await this.auth.register(dto);
    this.setSessionCookie(response, session.token, session.recordarme);

    return {
      usuario: session.usuario,
      mensaje: session.mensaje,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const session = await this.auth.login(dto);
    this.setSessionCookie(response, session.token, session.recordarme);

    return {
      usuario: session.usuario,
      mensaje: session.mensaje,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) response: Response): { mensaje: string } {
    response.clearCookie(SESSION_COOKIE_NAME, this.cookieOptions());

    return { mensaje: 'Sesión cerrada correctamente' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.CLIENTE, RolUsuario.OPERADOR, RolUsuario.ADMIN)
  me(@CurrentUser() usuario: AuthenticatedUser): AuthResponseDto {
    return {
      usuario,
      mensaje: 'Sesión activa',
    };
  }

  private setSessionCookie(
    response: Response,
    token: string,
    recordarme: boolean,
  ): void {
    response.cookie(SESSION_COOKIE_NAME, token, {
      ...this.cookieOptions(),
      ...(recordarme ? { maxAge: REMEMBER_MAX_AGE_MS } : {}),
    });
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('NODE_ENV') === 'production',
      path: '/',
    };
  }
}
