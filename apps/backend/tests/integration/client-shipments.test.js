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
const clienteEmail = `cliente-shipments-${suffix}@envioya.test`;
const otherEmail = `cliente-shipments-otro-${suffix}@envioya.test`;
const password = 'ClaveSegura123';

// Geocodificación y ruta mockeadas: el test no sale a la red.
// distanciaKm = 100 → días estimados = 1 (ceil(100/500)).
const mockGeo = {
  geocodeAddress: async () => ({ lat: -34.6037, lng: -58.3816 }),
  getDrivingRoute: async () => ({
    distanciaKm: 100,
    duracionEstimadaHoras: 1.25,
    distanciaEstimada: true,
  }),
};

const origen = {
  calle: 'Av. Corrientes',
  numero: '1234',
  ciudad: 'CABA',
  provincia: 'Buenos Aires',
  cp: '1043',
};

const destino = {
  calle: 'Av. Colón',
  numero: '850',
  ciudad: 'Córdoba',
  provincia: 'Córdoba',
  cp: '5000',
};

const validBody = {
  origen,
  destino,
  destinatario: { nombre: 'Destinatario Prueba', telefono: '+54 351 555-0001' },
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

// Tarija TAR-ESTANDAR: precioBase 3500, precioKm 180, precioKg 250,
// IVA 21 %. flete = 3500 + 100*180 + 2*250 = 22000; seguro = 500 (1 %);
// subtotal = 22500; iva = 4725; total = 27225.
const EXPECTED_FLETE = 22000;
const EXPECTED_TOTAL = 27225;

let app;
let db;
let baseUrl;
let sessionCookie = '';
let clienteId = '';
let otherCookie = '';
let otherClienteId = '';
let createdCodigo = '';

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
    const clienteIds = [clienteId, otherClienteId].filter(Boolean);
    if (clienteIds.length > 0) {
      await db.collection('envios').deleteMany({ clienteId: { $in: clienteIds } });
      await db.collection('clientes').deleteMany({ _id: { $in: clienteIds } });
    }
    await db.collection('usuarios').deleteMany({ email: { $in: [clienteEmail, otherEmail] } });
  }
  if (app) {
    await app.close();
  }
});

test('sin sesión responde 401', async () => {
  const response = await api('/shipments', { method: 'POST', body: validBody });
  assert.equal(response.status, 401);

  const list = await api('/shipments');
  assert.equal(list.status, 401);
});

test('prerequisito: tarifa TAR-ESTANDAR activa sembrada en envioya', async () => {
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

test('registro de cliente: cookie para los tests siguientes', async () => {
  const response = await api('/auth/register', {
    method: 'POST',
    body: {
      nombre: 'Cliente Envíos',
      email: clienteEmail,
      telefono: '+54 11 5555-0002',
      password,
    },
  });

  assert.equal(response.status, 201);
  clienteId = response.body.usuario.clienteId;
  sessionCookie = extractCookie(response.setCookies);
  assert.ok(sessionCookie.startsWith('envioya_session='));
});

test('registro de segundo cliente: para los tests de ownership', async () => {
  const response = await api('/auth/register', {
    method: 'POST',
    body: {
      nombre: 'Cliente Ajeno',
      email: otherEmail,
      telefono: '+54 11 5555-0003',
      password,
    },
  });

  assert.equal(response.status, 201);
  otherClienteId = response.body.usuario.clienteId;
  otherCookie = extractCookie(response.setCookies);
  assert.ok(otherCookie.startsWith('envioya_session='));
});

test('body con sucursalOrigenId responde 400 (campo no aceptado)', async () => {
  const response = await api('/shipments', {
    method: 'POST',
    headers: { Cookie: sessionCookie },
    body: { ...validBody, sucursalOrigenId: 'SUC-01' },
  });

  assert.equal(response.status, 400);
});

test('pesoKg inválido responde 400', async () => {
  const response = await api('/shipments', {
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
  const response = await api('/shipments', {
    method: 'POST',
    headers: { Cookie: sessionCookie },
    body: { ...validBody, paquetes: [] },
  });

  assert.equal(response.status, 400);
});

test('crear envío responde 201 pendiente con costo server-side y evento inicial', async () => {
  const response = await api('/shipments', {
    method: 'POST',
    headers: { Cookie: sessionCookie },
    body: validBody,
  });

  assert.equal(response.status, 201);
  const body = response.body;
  createdCodigo = body.codigo;

  assert.equal(body.estado, 'pendiente');
  assert.equal(body.cancelado, false);
  assert.equal(body.motivoCancelacion, null);
  assert.match(body.codigo, /^EY-[A-Z0-9]{6}$/);
  assert.equal(body._id, undefined, 'la respuesta no expone _id');

  // Costo consistente con la tarifa sembrada (server-side, nunca del cliente)
  assert.equal(body.costo.flete, EXPECTED_FLETE);
  assert.equal(body.costo.recargos, 0);
  assert.equal(body.costo.seguro, 500);
  assert.equal(body.costo.total, EXPECTED_TOTAL);

  // Paquetes con paqueteId generado
  assert.equal(body.totalPaquetes, 1);
  assert.equal(body.pesoTotalKg, 2);
  assert.ok(body.paquetes[0].paqueteId, 'paqueteId generado');

  // Evento inicial + fecha estimada ≥ creación
  assert.equal(body.totalEventos, 1);
  assert.equal(body.ultimosEventos.length, 1);
  assert.equal(body.ultimosEventos[0].tipo, 'cambio_estado');
  assert.equal(body.ultimosEventos[0].estado, 'pendiente');

  const creacion = Date.parse(body.fechaCreacion);
  const estimada = Date.parse(body.fechaEntregaEstimada);
  assert.ok(!Number.isNaN(creacion));
  assert.ok(!Number.isNaN(estimada));
  assert.ok(estimada >= creacion);
  assert.ok(estimada <= creacion + 2 * 86400000, 'fecha estimada dentro de la ventana esperada');
});

test('listar propios muestra el envío recién creado (page/limit defaults)', async () => {
  const response = await api('/shipments', {
    headers: { Cookie: sessionCookie },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.page, 1);
  assert.equal(response.body.limit, 10);
  assert.equal(response.body.total, 1);
  assert.equal(response.body.items.length, 1);
  const item = response.body.items[0];
  assert.equal(item.codigo, createdCodigo);
  assert.equal(item.estado, 'pendiente');
  assert.equal(item.cancelado, false);
  assert.equal(item.destinoCiudad, 'Córdoba');
  assert.equal(item.totalPaquetes, 1);
  assert.equal(item.pesoTotalKg, 2);
  assert.equal(item.total, EXPECTED_TOTAL);
});

test('filtro por estado: pendiente muestra, entregado no muestra', async () => {
  const pendiente = await api('/shipments?estado=pendiente', {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(pendiente.status, 200);
  assert.equal(pendiente.body.total, 1);

  const entregado = await api('/shipments?estado=entregado', {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(entregado.status, 200);
  assert.equal(entregado.body.total, 0);
});

test('cancelados=true sin cancelados no lista nada', async () => {
  const response = await api('/shipments?cancelados=true', {
    headers: { Cookie: sessionCookie },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 0);
  assert.equal(response.body.items.length, 0);
});

test('estado fuera del enum responde 400', async () => {
  const response = await api('/shipments?estado=cancelado', {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(response.status, 400);

  const response2 = await api('/shipments?estado=volador', {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(response2.status, 400);
});

test('detalle propio responde 200 con todos los campos', async () => {
  const response = await api(`/shipments/${createdCodigo}`, {
    headers: { Cookie: sessionCookie },
  });

  assert.equal(response.status, 200);
  const body = response.body;
  assert.equal(body.codigo, createdCodigo);
  assert.equal(body.estado, 'pendiente');
  assert.equal(body.cancelado, false);
  assert.equal(body.remitente.nombre, 'Cliente Envíos');
  assert.equal(body.remitente.direccion.ciudad, 'CABA');
  assert.equal(body.destinatario.nombre, 'Destinatario Prueba');
  assert.equal(body.destinatario.direccion.ciudad, 'Córdoba');
  assert.equal(body.costo.flete, EXPECTED_FLETE);
  assert.equal(body.costo.total, EXPECTED_TOTAL);
  assert.equal(body.ultimosEventos.length, 1);
  assert.equal(body.totalEventos, 1);
});

test('detalle de envío ajeno responde 404 (sin oráculo)', async () => {
  const response = await api(`/shipments/${createdCodigo}`, {
    headers: { Cookie: otherCookie },
  });

  assert.equal(response.status, 404);
});

test('detalle con código malformado responde 400', async () => {
  const response = await api('/shipments/not-a-code', {
    headers: { Cookie: sessionCookie },
  });

  assert.equal(response.status, 400);
});

test('detalle con código válido pero inexistente responde 404', async () => {
  const response = await api('/shipments/EY-ZZZZZZ', {
    headers: { Cookie: sessionCookie },
  });

  assert.equal(response.status, 404);
});

test('summary inicial: activos 1, gasto del mes y totalEnvios', async () => {
  const response = await api('/shipments/summary', {
    headers: { Cookie: sessionCookie },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.activos, 1);
  assert.equal(response.body.entregadosEsteMes, 0);
  assert.equal(response.body.gastoDelMes, EXPECTED_TOTAL);
  assert.equal(response.body.totalEnvios, 1);
});

test('cancelar sin motivo o con motivo corto responde 400', async () => {
  const sinMotivo = await api(`/shipments/${createdCodigo}/cancel`, {
    method: 'POST',
    headers: { Cookie: sessionCookie },
    body: {},
  });
  assert.equal(sinMotivo.status, 400);

  const motivoCorto = await api(`/shipments/${createdCodigo}/cancel`, {
    method: 'POST',
    headers: { Cookie: sessionCookie },
    body: { motivo: 'abc' },
  });
  assert.equal(motivoCorto.status, 400);
});

test('cancelar otro cliente responde 404 (sin oráculo)', async () => {
  const response = await api(`/shipments/${createdCodigo}/cancel`, {
    method: 'POST',
    headers: { Cookie: otherCookie },
    body: { motivo: 'Intento de cancelación ajena' },
  });

  assert.equal(response.status, 404);
});

test('cancelar código malformado responde 400', async () => {
  const response = await api('/shipments/nope/cancel', {
    method: 'POST',
    headers: { Cookie: sessionCookie },
    body: { motivo: 'Código inválido de prueba' },
  });

  assert.equal(response.status, 400);
});

test('cancelar envío propio pendiente responde 200 con evento', async () => {
  const motivo = 'Ya no lo necesito, cambié de plan';
  const response = await api(`/shipments/${createdCodigo}/cancel`, {
    method: 'POST',
    headers: { Cookie: sessionCookie },
    body: { motivo },
  });

  assert.equal(response.status, 200);
  const body = response.body;
  assert.equal(body.codigo, createdCodigo);
  assert.equal(body.cancelado, true);
  assert.equal(body.motivoCancelacion, motivo);
  assert.equal(body.totalEventos, 2);

  const ultimo = body.ultimosEventos[body.ultimosEventos.length - 1];
  assert.equal(ultimo.tipo, 'cambio_estado');
  assert.equal(ultimo.estado, 'pendiente');
  assert.ok(ultimo.descripcion.includes(`Cancelado por el cliente: ${motivo}`));
});

test('listar con cancelados=true muestra el envío cancelado', async () => {
  const response = await api('/shipments?cancelados=true', {
    headers: { Cookie: sessionCookie },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 1);
  assert.equal(response.body.items[0].codigo, createdCodigo);
  assert.equal(response.body.items[0].cancelado, true);

  // Sin el flag, el default sigue listando todos los propios
  const todos = await api('/shipments', {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(todos.status, 200);
  assert.equal(todos.body.total, 1);
  assert.equal(todos.body.items[0].cancelado, true);
});

test('summary post-cancel: activos 0, gastoDelMes 0, totalEnvios 1', async () => {
  const response = await api('/shipments/summary', {
    headers: { Cookie: sessionCookie },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.activos, 0);
  assert.equal(response.body.gastoDelMes, 0);
  assert.equal(response.body.totalEnvios, 1);
});

test('cancelar de nuevo responde 409', async () => {
  const response = await api(`/shipments/${createdCodigo}/cancel`, {
    method: 'POST',
    headers: { Cookie: sessionCookie },
    body: { motivo: 'Intento duplicado de cancelación' },
  });

  assert.equal(response.status, 409);
});

test('cancelar con estado distinto a pendiente responde 409', async () => {
  // Simula una transición operativa fuera del portal del cliente: el envío
  // sigue propio y cancelado=false, pero ya no está pendiente.
  const created = await api('/shipments', {
    method: 'POST',
    headers: { Cookie: sessionCookie },
    body: validBody,
  });
  assert.equal(created.status, 201);
  await db
    .collection('envios')
    .updateOne({ codigo: created.body.codigo }, { $set: { estado: 'en_transito' } });

  const response = await api(`/shipments/${created.body.codigo}/cancel`, {
    method: 'POST',
    headers: { Cookie: sessionCookie },
    body: { motivo: 'Intento de cancelación en tránsito' },
  });

  assert.equal(response.status, 409);
});

test('cancelar con repartidor asignado responde 409', async () => {
  const created = await api('/shipments', {
    method: 'POST',
    headers: { Cookie: sessionCookie },
    body: validBody,
  });
  assert.equal(created.status, 201);
  await db
    .collection('envios')
    .updateOne({ codigo: created.body.codigo }, { $set: { repartidorId: 'REP-01' } });

  const response = await api(`/shipments/${created.body.codigo}/cancel`, {
    method: 'POST',
    headers: { Cookie: sessionCookie },
    body: { motivo: 'Intento con repartidor asignado' },
  });

  assert.equal(response.status, 409);
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
