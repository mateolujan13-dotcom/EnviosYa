const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const bcrypt = require('bcrypt');
const { NestFactory } = require('@nestjs/core');

const { AppModule } = require(path.join(__dirname, '..', '..', 'dist', 'app.module'));
const { configureApp } = require(path.join(__dirname, '..', '..', 'dist', 'app.setup'));
const {
  MongoDatabaseService,
} = require(path.join(__dirname, '..', '..', 'dist', 'database', 'mongo-database.service'));

const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
const clienteEmail = `cliente-auth-${suffix}@envioya.test`;
const operadorEmail = `operador-auth-${suffix}@envioya.test`;
const password = 'ClaveSegura123';
const operadorPassword = 'OperadorSeguro123';

let app;
let db;
let baseUrl;
let sessionCookie = '';
let clienteId = '';

before(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
  db = app.get(MongoDatabaseService).getDb();
});

after(async () => {
  if (db) {
    await db.collection('usuarios').deleteMany({
      email: { $in: [clienteEmail, operadorEmail] },
    });
    if (clienteId) {
      await db.collection('clientes').deleteMany({ _id: clienteId });
    }
  }
  if (app) {
    await app.close();
  }
});

test('registra un cliente, hashea con bcrypt 12 y setea la cookie httpOnly', async () => {
  const response = await api('/auth/register', {
    method: 'POST',
    body: {
      nombre: 'Lucía Cliente',
      email: clienteEmail.toUpperCase(),
      telefono: '+54 11 5555-1234',
      password,
    },
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.usuario.email, clienteEmail);
  assert.equal(response.body.usuario.rol, 'cliente');
  assert.ok(response.body.usuario.clienteId);
  assert.equal(response.body.usuario.passwordHash, undefined);

  sessionCookie = extractCookie(response.setCookies);
  assert.ok(sessionCookie.startsWith('envioya_session='));

  const cookieHeader = response.setCookies.find((cookie) =>
    cookie.startsWith('envioya_session='),
  );
  assert.match(cookieHeader, /HttpOnly/i);
  assert.match(cookieHeader, /SameSite=Lax/i);

  const usuario = await db.collection('usuarios').findOne({ email: clienteEmail });
  assert.ok(usuario);
  assert.equal(bcrypt.getRounds(usuario.passwordHash), 12);

  clienteId = usuario.clienteId;
  const cliente = await db.collection('clientes').findOne({ _id: clienteId });
  assert.ok(cliente);
  assert.equal(cliente.contacto.email, clienteEmail);
  assert.equal(cliente.direccionFacturacion, undefined);
});

test('GET /auth/me devuelve la sesión activa desde la cookie', async () => {
  const response = await api('/auth/me', {
    headers: { Cookie: sessionCookie },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.usuario.email, clienteEmail);
  assert.equal(response.body.usuario.rol, 'cliente');
});

test('rechaza un email ya registrado con 409', async () => {
  const response = await api('/auth/register', {
    method: 'POST',
    body: {
      nombre: 'Otra Persona',
      email: clienteEmail,
      telefono: '11 4444-5555',
      password,
    },
  });

  assert.equal(response.status, 409);
  assert.match(response.body.message, /ya existe una cuenta/i);
});

test('valida contraseña débil y campos extra', async () => {
  const weak = await api('/auth/register', {
    method: 'POST',
    body: {
      nombre: 'Cliente Débil',
      email: `debil-${suffix}@envioya.test`,
      telefono: '11 4444-5555',
      password: 'corta',
    },
  });

  assert.equal(weak.status, 400);

  const extra = await api('/auth/register', {
    method: 'POST',
    body: {
      nombre: 'Cliente Extra',
      email: `extra-${suffix}@envioya.test`,
      telefono: '11 4444-5555',
      password,
      direccion: { calle: 'Falsa', numero: 123 },
    },
  });

  assert.equal(extra.status, 400);
});

test('login con credenciales inválidas responde el mismo error genérico', async () => {
  const existente = await api('/auth/login', {
    method: 'POST',
    body: { email: clienteEmail, password: 'PasswordIncorrecta1' },
  });
  const inexistente = await api('/auth/login', {
    method: 'POST',
    body: { email: `no-existe-${suffix}@envioya.test`, password: 'PasswordIncorrecta1' },
  });

  assert.equal(existente.status, 401);
  assert.equal(inexistente.status, 401);
  assert.equal(existente.body.message, inexistente.body.message);
  assert.match(existente.body.message, /email o contraseña incorrectos/i);
});

test('login exitoso rota la cookie y "recordarme" la persiste 7 días', async () => {
  const response = await api('/auth/login', {
    method: 'POST',
    body: { email: clienteEmail, password, recordarme: true },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.usuario.email, clienteEmail);

  const cookieHeader = response.setCookies.find((cookie) =>
    cookie.startsWith('envioya_session='),
  );
  assert.match(cookieHeader, /Max-Age=604800/i);

  sessionCookie = extractCookie(response.setCookies);

  const me = await api('/auth/me', { headers: { Cookie: sessionCookie } });
  assert.equal(me.status, 200);
  assert.equal(me.body.usuario.email, clienteEmail);
});

test('un operador inicia sesión y /auth/me conserva su rol', async () => {
  const operadorPasswordHash = await bcrypt.hash(operadorPassword, 12);
  await db.collection('usuarios').insertOne({
    _id: `USR-OP-${suffix}`,
    email: operadorEmail,
    passwordHash: operadorPasswordHash,
    nombre: 'Operador de Prueba',
    rol: 'operador',
    activo: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const login = await api('/auth/login', {
    method: 'POST',
    body: { email: operadorEmail, password: operadorPassword },
  });

  assert.equal(login.status, 200);
  assert.equal(login.body.usuario.rol, 'operador');

  const operadorCookie = extractCookie(login.setCookies);
  const me = await api('/auth/me', {
    headers: { Cookie: operadorCookie },
  });

  assert.equal(me.status, 200);
  assert.equal(me.body.usuario.rol, 'operador');
});

test('logout limpia la cookie y /auth/me queda sin sesión', async () => {
  const response = await api('/auth/logout', {
    method: 'POST',
    headers: { Cookie: sessionCookie },
  });

  assert.equal(response.status, 200);
  assert.match(response.body.mensaje, /sesión cerrada/i);

  const cleared = response.setCookies.find((cookie) =>
    cookie.startsWith('envioya_session='),
  );
  assert.ok(cleared);
  assert.match(cleared, /Expires=Thu, 01 Jan 1970/i);

  const me = await api('/auth/me');
  assert.equal(me.status, 401);
});

async function api(pathname, options = {}) {
  const headers = { ...(options.headers ?? {}) };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${baseUrl}/api${pathname}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  const setCookies =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [];

  return { status: response.status, body, setCookies };
}

function extractCookie(setCookies) {
  const session = setCookies.find((cookie) =>
    cookie.startsWith('envioya_session='),
  );

  return session ? session.split(';')[0] : '';
}
