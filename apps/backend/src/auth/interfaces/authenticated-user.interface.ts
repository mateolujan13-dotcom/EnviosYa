import { RolUsuario } from '@envioya/shared';

export interface AuthenticatedUser {
  _id: string;
  email: string;
  nombre: string;
  rol: RolUsuario;
  clienteId?: string;
}
