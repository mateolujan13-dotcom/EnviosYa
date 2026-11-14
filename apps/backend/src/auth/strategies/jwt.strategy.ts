import { JwtPayload } from '@envioya/shared';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersRepository } from '../../repositories/users.repository';
import { resolveJwtSecret } from '../auth.config';
import { SESSION_COOKIE_NAME } from '../auth.constants';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly users: UsersRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => request?.cookies?.[SESSION_COOKIE_NAME] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(config),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const usuario = await this.users.findById(payload.sub);

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Sesión no válida o expirada');
    }

    return {
      _id: usuario._id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      clienteId: usuario.clienteId,
    };
  }
}
