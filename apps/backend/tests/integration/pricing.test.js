const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { Test } = require('@nestjs/testing');
const { AppModule } = require(path.join(__dirname, '..', '..', 'dist', 'app.module'));
const {
  configureApp,
} = require(path.join(__dirname, '..', '..', 'dist', 'app.setup'));
const {
  GeoService,
} = require(path.join(__dirname, '..', '..', 'dist', 'geo', 'geo.service'));
const {
  MongoDatabaseService,
} = require(path.join(__dirname, '..', '..', 'dist', 'database', 'mongo-database.service'));

const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
const clienteEmail = `cliente-quote-${suffix}@envioya.test`;
const password = 'ClaveSegura123';

// Geocodificación y ruta mockeadas: el test no sale a la red.
const mockGeo = {
  geocodeAddress: async () => ({ lat: -34.6037, lng: -58.3816 }),
  getDrivingRoute: async () => ({
    distanciaKm: 120,
    duracionEstimadaHoras: 1.5,
    distanciaEstimada: true,
  }),
};

const validBody = {
  origen: {
    calle: 'Av. Corrientes',
    numero: '1234',
    ciudad: 'CABA',
    provincia: 'Buenos Aires',
    cp: '1043',
  },
  destino: {
    calle: 'Av. Colón',
    numero: '850',
    ciudad: 'Córdoba',
    provincia: 'Córdoba',
    cp: '5000',
  },
  paquetes: [
    {
      descripcion: 'Caja',
      pesoKg: 2,
      dimensiones: { altoCm: 10, anchoCm: 10, profundoCm: 10 },
      fragil: false,
      caracteristicas: [{ k: 'valorDeclarado', v: 50000 }],
    },
  ],
};

let app;
let db;
let baseUrl;
let sessionCookie = '';
let clienteId = '';

before(async () => {
  const testingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(GeoService)
    .useValue(mockGeo)
    .compile();

  app = testingModule.createNestApplication({ logger: false });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
  db = app.get(MongoDatabaseService).getDb();
});

after(async () => {
  if (db) {
    await db.collection('usuarios').deleteMany({ email: clienteEmail });
    if (clienteId) {
      await db.collection('clientes').deleteMany({ _id: clienteId });
    }
  }
  if (app) {
    await app.close();
  }
});

test('sin sesión responde 401', async () => {
  const response = await api('/pricing/quote', {
    method: 'POST',
    body: validBody,
  });

  assert.equal(response.status, 401);
});

test('registro de cliente: cookie para los tests siguientes', async () => {
  const response = await api('/auth/register', {
    method: 'POST',
    body: {
      nombre: 'Cliente Cotizador',
      email: clienteEmail,
      telefono: '+54 11 5555-0001',
      password,
    },
  });

  assert.equal(response.status, 201);
  clienteId = response.body.usuario.clienteId;
  sessionCookie = extractCookie(response.setCookies);
  assert.ok(sessionCookie.startsWith('envioya_session='));
});

test('quote con sesión responde 200 con desglose completo (sin red)', async () => {
  const response = await api('/pricing/quote', {
    method: 'POST',
    headers: { Cookie: sessionCookie },
    body: validBody,
  });

  assert.equal(response.status, 200);
  const body = response.body;

  assert.equal(body.distanciaEstimada, true, 'mock geo => distancia estimada');
  assert.equal(body.distanciaKm, 120);
  assert.equal(body.pesoTotalKg, 2);
  assert.equal(body.volumenTotalM3, 0.001);
  assert.equal(body.moneda, 'ARS');
  assert.deepEqual(body.desglose, {
    precioBase: 3500,
    adicionalDistancia: 21600,
    adicionalPeso: 500,
    adicionalFragil: 0,
    seguro: 500,
    subtotal: 26100,
    iva: 5481,
    total: 31581,
  });
  assert.equal(body.desglose.total, Math.round((body.desglose.subtotal + body.desglose.iva) * 100) / 100);
});

test('body con campo extra responde 400 (forbidNonWhitelisted)', async () => {
  const response = await api('/pricing/quote', {
    method: 'POST',
    headers: { Cookie: sessionCookie },
    body: { ...validBody, hacker: 'x' },
  });

  assert.equal(response.status, 400);
});

test('pesoKg inválido responde 400', async () => {
  const response = await api('/pricing/quote', {
    method: 'POST',
    headers: { Cookie: sessionCookie },
    body: {
      ...validBody,
      paquetes: [{ ...validBody.paquetes[0], pesoKg: -1 }],
    },
  });

  assert.equal(response.status, 400);
});

test('paquetes vacío responde 400', async () => {
  const response = await api('/pricing/quote', {
    method: 'POST',
    headers: { Cookie: sessionCookie },
    body: { ...validBody, paquetes: [] },
  });

  assert.equal(response.status, 400);
});

test('prerequisito: tarifa TAR-ESTANDAR activa sembrada en envioya', async () => {
  // La siembra la hace scripts/seed-tarifa.js (npm run db:seed:tarifa).
  const tarifa = await db.collection('tarifas').findOne({
    _id: 'TAR-ESTANDAR',
    activa: true,
  });

  assert.ok(
    tarifa,
    'falta TAR-ESTANDAR activa; ejecutá npm run db:seed:tarifa --workspace=@envioya/backend',
  );
  assert.equal(tarifa.moneda, 'ARS');
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
