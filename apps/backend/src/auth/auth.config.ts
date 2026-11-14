import { ConfigService } from '@nestjs/config';
import { DEV_JWT_SECRET } from './auth.constants';

/**
 * En producción el secreto es obligatorio. En desarrollo y tests se usa un
 * fallback local para no bloquear el arranque sin `.env`.
 */
export function resolveJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');

  if (secret && secret.trim().length > 0) {
    return secret;
  }

  if (config.get<string>('NODE_ENV') === 'production') {
    throw new Error('JWT_SECRET es obligatorio en producción');
  }

  return DEV_JWT_SECRET;
}
