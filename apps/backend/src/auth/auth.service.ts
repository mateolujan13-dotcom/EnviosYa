import {
  AuthResponseDto,
  AuthUserDto,
  IClienteDocument,
  IUsuarioDocument,
  JwtPayload,
  LoginDto,
  RegisterDto,
  RolUsuario,
  TipoCliente,
} from '@envioya/shared';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { ClientsRepository } from '../repositories/clients.repository';
import { UsersRepository } from '../repositories/users.repository';
import { BCRYPT_ROUNDS } from './auth.constants';

const INVALID_CREDENTIALS_MESSAGE = 'Email o contraseña incorrectos';

/**
 * Hash de descarte con costo 12. Se usa cuando el email no existe para que el
 * login tarde lo mismo que con un usuario real y no filtre información.
 */
const DUMMY_PASSWORD_HASH =
  '$2b$12$m9qFhKyc4mWY3XF2soEAN.E4pr6dAlH/gj/zTR2OjLQofReALtx2S';

export interface AuthSessionResult extends AuthResponseDto {
  token: string;
  expiresIn: string;
  recordarme: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly clients: ClientsRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthSessionResult> {
    const email = dto.email.trim().toLowerCase();
    const nombre = dto.nombre.trim();

    const existingUser = await this.users.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Ya existe una cuenta con este email');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const now = new Date();
    const clienteId = this.generateId('CLI');

    const cliente: IClienteDocument = {
      _id: clienteId,
      tipo: dto.tipoCliente ?? TipoCliente.PARTICULAR,
      razonSocial: nombre,
      contacto: {
        nombre,
        email,
        telefono: dto.telefono.trim(),
      },
      fechaAlta: now,
      activo: true,
      schemaVersion: 1,
    };

    await this.clients.insertOne(cliente);

    let usuario: IUsuarioDocument;

    try {
      usuario = await this.users.insertOne({
        _id: this.generateId('USR'),
        email,
        passwordHash,
        nombre,
        rol: RolUsuario.CLIENTE,
        clienteId,
        activo: true,
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      // Compensación: si no se pudo crear el usuario, no dejamos un cliente huérfano.
      await this.clients.deleteById(clienteId).catch(() => undefined);

      if (isDuplicateKeyError(error)) {
        throw new ConflictException('Ya existe una cuenta con este email');
      }

      throw error;
    }

    const session = await this.createSession(usuario, false);

    return {
      ...session,
      mensaje: 'Cuenta creada correctamente',
    };
  }

  async login(dto: LoginDto): Promise<AuthSessionResult> {
    const email = dto.email.trim().toLowerCase();
    const usuario = await this.users.findByEmail(email);

    // Comparación con hash de descarte para no revelar si el email existe.
    const passwordOk = await bcrypt.compare(
      dto.password,
      usuario?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!usuario || !usuario.activo || !passwordOk) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const session = await this.createSession(usuario, dto.recordarme === true);

    return {
      ...session,
      mensaje: 'Sesión iniciada correctamente',
    };
  }

  private async createSession(
    usuario: IUsuarioDocument,
    recordarme: boolean,
  ): Promise<AuthSessionResult> {
    const payload: JwtPayload = {
      sub: usuario._id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      clienteId: usuario.clienteId,
    };

    const expiresIn = recordarme
      ? this.config.get<string>('JWT_REMEMBER_EXPIRES_IN') ?? '7d'
      : this.config.get<string>('JWT_EXPIRES_IN') ?? '24h';

    const token = await this.jwt.signAsync(payload, {
      expiresIn: expiresIn as JwtSignOptions['expiresIn'],
    });

    return {
      usuario: toAuthUser(usuario),
      mensaje: 'Sesión iniciada correctamente',
      token,
      expiresIn,
      recordarme,
    };
  }

  private generateId(prefix: 'USR' | 'CLI'): string {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;
  }
}

export function toAuthUser(usuario: IUsuarioDocument): AuthUserDto {
  return {
    _id: usuario._id,
    email: usuario.email,
    nombre: usuario.nombre,
    rol: usuario.rol,
    clienteId: usuario.clienteId,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}
