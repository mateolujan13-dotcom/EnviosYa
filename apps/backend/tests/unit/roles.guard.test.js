const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  ForbiddenException,
  UnauthorizedException,
} = require('@nestjs/common');

const {
  RolesGuard,
} = require(path.join(__dirname, '..', '..', 'dist', 'auth', 'guards', 'roles.guard'));

function createContext(user) {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  };
}

function createGuard(requiredRoles) {
  const reflector = {
    getAllAndOverride: () => requiredRoles,
  };

  return new RolesGuard(reflector);
}

test('RolesGuard permite el paso cuando no hay roles declarados', () => {
  const guard = createGuard(undefined);

  assert.equal(guard.canActivate(createContext(undefined)), true);
});

test('RolesGuard permite a un rol incluido en el decorador', () => {
  const guard = createGuard(['operador', 'admin']);

  assert.equal(
    guard.canActivate(createContext({ _id: 'USR-1', rol: 'operador' })),
    true,
  );
});

test('RolesGuard rechaza a un rol no autorizado con 403', () => {
  const guard = createGuard(['operador', 'admin']);

  assert.throws(
    () => guard.canActivate(createContext({ _id: 'USR-1', rol: 'cliente' })),
    ForbiddenException,
  );
});

test('RolesGuard rechaza sin usuario autenticado con 401', () => {
  const guard = createGuard(['cliente']);

  assert.throws(
    () => guard.canActivate(createContext(undefined)),
    UnauthorizedException,
  );
});
