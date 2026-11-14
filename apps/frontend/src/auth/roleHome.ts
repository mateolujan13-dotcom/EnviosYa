import { RolUsuario } from '@envioya/shared';

export function homeForRole(rol: RolUsuario): string {
  return rol === RolUsuario.CLIENTE ? '/app' : '/ops';
}

export function roleLabel(rol: RolUsuario): string {
  switch (rol) {
    case RolUsuario.CLIENTE:
      return 'Cliente';
    case RolUsuario.OPERADOR:
      return 'Operador';
    case RolUsuario.ADMIN:
      return 'Administrador';
    default:
      return rol;
  }
}
