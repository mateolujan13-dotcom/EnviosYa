const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const bcrypt = require('bcrypt');
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
const clienteEmail = `cliente-ops-${suffix}@envioya.test`;
const operadorEmail = `operador-ops-${suffix}@envioya.test`;
const password = 'ClaveSegura123';
const operadorPassword = 'OperadorSeguro123';

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
  destinatario: { nombre: 'Destinatario Ops', telefono: '+54 351 555-0009' },
  // caracteristicas con valorDeclarado: el backend serializa un paquete sin
  // `caracteristicas` como null y el validator TP9 lo rechaza (pre-existente).
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

const heavyBody = {
  ...validBody,
  paquetes: [
    {
      descripcion: 'Pallet pesado',
      pesoKg: 60,
      dimensiones: { altoCm: 50, anchoCm: 50, profundoCm: 50 },
      fragil: false,
      caracteristicas: [{ k: 'valorDeclarado', v: 120000 }],
    },
  ],
};

const REP_IDS = ['REP-01', 'REP-02', 'REP-03', 'REP-04', 'REP-05'];
const VEH_IDS = ['VEH-01', 'VEH-02', 'VEH-03', 'VEH-04', 'VEH-05'];

let app;
let db;
let baseUrl;
let sessionCookie = '';
let operadorCookie = '';
let clienteId = '';
let createdCodigo = '';
let createdEnvioId = '';
let sucursalDestinoId = '';
let sucursalOrigenId = '';
const trackedEnvioIds = [];

// Snapshot de recursos seed (solo lectura) restaurado en after().
let repartidorSnapshot = [];
let vehiculoSnapshot = [];

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

  repartidorSnapshot = await db
    .collection('repartidores')
    .find({ _id: { $in: REP_IDS } })
    .toArray();
  vehiculoSnapshot = await db
    .collection('vehiculos')
    .find({ _id: { $in: VEH_IDS } })
    .toArray();
});

after(async () => {
  if (db) {
    if (trackedEnvioIds.length > 0) {
      await db.collection('envios').deleteMany({ _id: { $in: trackedEnvioIds } });
      await db
        .collection('eventos_seguimiento')
        .deleteMany({ envioId: { $in: trackedEnvioIds } });
    }
    await db
      .collection('usuarios')
      .deleteMany({ email: { $in: [clienteEmail, operadorEmail] } });
    if (clienteId) {
      await db.collection('clientes').deleteMany({ _id: clienteId });
    }

    // Restaurar estado seed de recursos efímeros usados por los tests.
    for (const snap of repartidorSnapshot) {
      await db
        .collection('repartidores')
        .updateOne({ _id: snap._id }, { $set: { estado: snap.estado } });
    }
    for (const snap of vehiculoSnapshot) {
      const set = { estado: snap.estado };
      if (snap.cargaActualKg === undefined) {
        await db
          .collection('vehiculos')
          .updateOne({ _id: snap._id }, { $set: set, $unset: { cargaActualKg: '' } });
      } else {
        await db
          .collection('vehiculos')
          .updateOne({ _id: snap._id }, { $set: { ...set, cargaActualKg: snap.cargaActualKg } });
      }
    }
  }
  if (app) {
    await app.close();
  }
});

test('sin sesión responde 401 en las rutas /ops', async () => {
  const list = await api('/ops/shipments');
  assert.equal(list.status, 401);

  const detail = await api('/ops/shipments/EY-4F8A1C');
  assert.equal(detail.status, 401);

  const dispatch = await api('/ops/shipments/EY-4F8A1C/dispatch', { method: 'POST' });
  assert.equal(dispatch.status, 401);
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
});

test('registro de cliente efímero: cookie para crear envíos', async () => {
  const response = await api('/auth/register', {
    method: 'POST',
    body: {
      nombre: 'Cliente Ops',
      email: clienteEmail,
      telefono: '+54 11 5555-0007',
      password,
    },
  });

  assert.equal(response.status, 201);
  clienteId = response.body.usuario.clienteId;
  sessionCookie = extractCookie(response.setCookies);
});

test('alta de operador efímero + login: cookie con rol operador', async () => {
  const passwordHash = await bcrypt.hash(operadorPassword, 12);
  await db.collection('usuarios').insertOne({
    _id: `USR-OP-${suffix}`,
    email: operadorEmail,
    passwordHash,
    nombre: 'Operador Ops',
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
  operadorCookie = extractCookie(login.setCookies);
});

test('cliente autenticado no puede usar /ops: responde 403', async () => {
  const list = await api('/ops/shipments', { headers: { Cookie: sessionCookie } });
  assert.equal(list.status, 403);

  const summary = await api('/ops/shipments/summary', {
    headers: { Cookie: sessionCookie },
  });
  assert.equal(summary.status, 403);

  const incident = await api('/ops/shipments/EY-4F8A1C/incident', {
    method: 'POST',
    headers: { Cookie: sessionCookie },
    body: { observacion: 'cliente intenta incidencia' },
  });
  assert.equal(incident.status, 403);
});

test('crear envío efímero (portal cliente) y leer ids para los tests ops', async () => {
  const response = await api('/shipments', {
    method: 'POST',
    headers: { Cookie: sessionCookie },
    body: validBody,
  });

  assert.equal(response.status, 201);
  createdCodigo = response.body.codigo;
  assert.match(createdCodigo, /^EY-[A-Z0-9]{6}$/);
  assert.equal(response.body.pesoTotalKg, 2);
  assert.equal(response.body.estado, 'pendiente');

  const doc = await db.collection('envios').findOne({ codigo: createdCodigo });
  createdEnvioId = doc._id;
  sucursalDestinoId = doc.sucursalDestinoId;
  sucursalOrigenId = doc.sucursalOrigenId;
  trackedEnvioIds.push(doc._id);
});

test('GET /ops/shipments lista el envío con filtros por estado/sucursal/q', async () => {
  const pendiente = await api('/ops/shipments?estado=pendiente', {
    headers: { Cookie: operadorCookie },
  });
  assert.equal(pendiente.status, 200);
  assert.equal(pendiente.body.page, 1);
  assert.equal(pendiente.body.limit, 10);
  const found = pendiente.body.items.find((item) => item.codigo === createdCodigo);
  assert.ok(found, 'la bandeja lista el envío pendiente');
  assert.equal(found.estado, 'pendiente');
  assert.equal(found.cancelado, false);
  assert.equal(found.cliente, 'Cliente Ops');
  assert.equal(found.origenCiudad, 'CABA');
  assert.equal(found.destinoCiudad, 'Córdoba');
  assert.equal(found.totalPaquetes, 1);
  assert.equal(found.pesoTotalKg, 2);
  assert.equal(found._id, undefined, 'la bandeja no expone _id');

  const entregado = await api('/ops/shipments?estado=entregado', {
    headers: { Cookie: operadorCookie },
  });
  assert.equal(entregado.status, 200);
  assert.ok(
    entregado.body.items.every((item) => item.codigo !== createdCodigo),
    'filtro estado=entregado excluye el pendiente',
  );

  // sucursalId matchea origen, actual o destino
  const porDestino = await api(`/ops/shipments?sucursalId=${sucursalDestinoId}`, {
    headers: { Cookie: operadorCookie },
  });
  assert.ok(
    porDestino.body.items.some((item) => item.codigo === createdCodigo),
    'sucursalId=destino encuentra el envío',
  );

  const porOrigen = await api(`/ops/shipments?sucursalId=${sucursalOrigenId}`, {
    headers: { Cookie: operadorCookie },
  });
  assert.ok(
    porOrigen.body.items.some((item) => item.codigo === createdCodigo),
    'sucursalId=origen encuentra el envío',
  );

  const porInexistente = await api('/ops/shipments?sucursalId=SUC-NOPE', {
    headers: { Cookie: operadorCookie },
  });
  assert.ok(
    porInexistente.body.items.every((item) => item.codigo !== createdCodigo),
    'sucursalId sin coincidencia no lista el envío',
  );

  // q: parcial case-insensitive sobre codigo
  const q = createdCodigo.slice(3, 9).toLowerCase();
  const porQ = await api(`/ops/shipments?q=${q}`, {
    headers: { Cookie: operadorCookie },
  });
  assert.ok(
    porQ.body.items.some((item) => item.codigo === createdCodigo),
    'q parcial en minúsculas encuentra el envío',
  );

  const sinMatch = await api('/ops/shipments?q=zzzzzz', {
    headers: { Cookie: operadorCookie },
  });
  assert.ok(
    sinMatch.body.items.every((item) => item.codigo !== createdCodigo),
    'q sin coincidencia no lista el envío',
  );
});

test('GET /ops/shipments?estado ⇢ 400 fuera del enum', async () => {
  const response = await api('/ops/shipments?estado=cancelado', {
    headers: { Cookie: operadorCookie },
  });
  assert.equal(response.status, 400);

  const volador = await api('/ops/shipments?estado=volador', {
    headers: { Cookie: operadorCookie },
  });
  assert.equal(volador.status, 400);
});

test('GET /ops/shipments/summary (y alias /ops/summary) responde 200 con KPIs', async () => {
  const response = await api('/ops/shipments/summary', {
    headers: { Cookie: operadorCookie },
  });
  assert.equal(response.status, 200);
  for (const key of [
    'pendiente',
    'en_transito',
    'en_sucursal',
    'en_reparto',
    'con_incidencia',
    'entregado',
    'devuelto',
    'total',
  ]) {
    assert.equal(typeof response.body[key], 'number', `summary tiene ${key} numérico`);
  }
  assert.ok(response.body.pendiente >= 1);

  const alias = await api('/ops/summary', {
    headers: { Cookie: operadorCookie },
  });
  assert.equal(alias.status, 200);
  assert.equal(typeof alias.body.total, 'number');
});

test('GET /ops/shipments/:codigo devuelve el detalle ops completo', async () => {
  const response = await api(`/ops/shipments/${createdCodigo}`, {
    headers: { Cookie: operadorCookie },
  });

  assert.equal(response.status, 200);
  const body = response.body;
  assert.equal(body.codigo, createdCodigo);
  assert.equal(body.estado, 'pendiente');
  assert.equal(body.cancelado, false);
  assert.equal(body._id, undefined, 'el detalle no expone _id');
  assert.equal(body.clienteResumen.nombre, 'Cliente Ops');
  assert.equal(body.origen.ciudad, 'CABA');
  assert.equal(body.destino.ciudad, 'Córdoba');
  assert.equal(body.remitente.nombre, 'Cliente Ops');
  assert.equal(body.destinatario.nombre, 'Destinatario Ops');
  assert.ok(body.paquetes[0].paqueteId, 'paqueteId presente');
  assert.equal(body.costo.total, 27225);
  assert.equal(body.sucursalActualId, null);
  assert.equal(body.repartidor, null);
  assert.equal(body.vehiculo, null);
  assert.equal(body.totalEventos, 1);
  assert.equal(body.ultimosEventos.length, 1);
});

test('detalle con código malformado ⇢ 400 y desconocido ⇢ 404', async () => {
  const malformed = await api('/ops/shipments/nope', {
    headers: { Cookie: operadorCookie },
  });
  assert.equal(malformed.status, 400);

  const unknown = await api('/ops/shipments/EY-ZZZZZZ', {
    headers: { Cookie: operadorCookie },
  });
  assert.equal(unknown.status, 404);

  const dispatchUnknown = await api('/ops/shipments/EY-ZZZZZZ/dispatch', {
    method: 'POST',
    headers: { Cookie: operadorCookie },
  });
  assert.equal(dispatchUnknown.status, 404);
});

test('assign REP-01 + VEH-01: 200, efectos en recursos y evento asignacion_reparto', async () => {
  const response = await api(`/ops/shipments/${createdCodigo}/assign`, {
    method: 'POST',
    headers: { Cookie: operadorCookie },
    body: { repartidorId: 'REP-01', vehiculoId: 'VEH-01' },
  });

  assert.equal(response.status, 200);
  const body = response.body;
  assert.equal(body.estado, 'pendiente', 'assign desde pendiente no cambia el estado');
  assert.equal(body.repartidor._id, 'REP-01');
  assert.equal(body.repartidor.nombre, 'Carlos Díaz');
  assert.equal(body.vehiculo._id, 'VEH-01');
  assert.equal(body.vehiculo.cargaActualKg, 2);
  assert.equal(body.vehiculo.capacidadKg, 1200);
  const ultimo = body.ultimosEventos[body.ultimosEventos.length - 1];
  assert.equal(ultimo.tipo, 'asignacion_reparto');
  assert.equal(ultimo.estado, 'pendiente');
  assert.equal(body.totalEventos, 2);

  const repartidor = await db.collection('repartidores').findOne({ _id: 'REP-01' });
  assert.equal(repartidor.estado, 'en_reparto');
  const vehiculo = await db.collection('vehiculos').findOne({ _id: 'VEH-01' });
  assert.equal(vehiculo.cargaActualKg, 2);
});

test('re-asignar el mismo par es idempotente: 200 y carga sin duplicar', async () => {
  const response = await api(`/ops/shipments/${createdCodigo}/assign`, {
    method: 'POST',
    headers: { Cookie: operadorCookie },
    body: { repartidorId: 'REP-01', vehiculoId: 'VEH-01' },
  });

  assert.equal(response.status, 200);
  const vehiculo = await db.collection('vehiculos').findOne({ _id: 'VEH-01' });
  assert.equal(vehiculo.cargaActualKg, 2);
  const repartidor = await db.collection('repartidores').findOne({ _id: 'REP-01' });
  assert.equal(repartidor.estado, 'en_reparto');
});

test('deliver desde pendiente responde 409', async () => {
  const response = await api(`/ops/shipments/${createdCodigo}/deliver`, {
    method: 'POST',
    headers: { Cookie: operadorCookie },
  });

  assert.equal(response.status, 409);
  assert.match(String(response.body.message), /Transición no permitida/);
});

test('dispatch ⇢ 200 en_transito con fechaDespacho; sucursalActualId null', async () => {
  const response = await api(`/ops/shipments/${createdCodigo}/dispatch`, {
    method: 'POST',
    headers: { Cookie: operadorCookie },
  });

  assert.equal(response.status, 200);
  const body = response.body;
  assert.equal(body.estado, 'en_transito');
  assert.ok(body.fechaDespacho, 'fechaDespacho seteada');
  assert.equal(body.sucursalActualId, null);
  const ultimo = body.ultimosEventos[body.ultimosEventos.length - 1];
  assert.equal(ultimo.tipo, 'cambio_estado');

  const doc = await db.collection('envios').findOne({ _id: createdEnvioId });
  assert.equal(doc.sucursalActualId, null);
});

test('dispatch dos veces responde 409', async () => {
  const response = await api(`/ops/shipments/${createdCodigo}/dispatch`, {
    method: 'POST',
    headers: { Cookie: operadorCookie },
  });

  assert.equal(response.status, 409);
  assert.match(String(response.body.message), /Transición no permitida/);
});

test('arrive ⇢ 200 en_sucursal con sucursalActualId = destino', async () => {
  const beforeArrive = await api(`/ops/shipments/${createdCodigo}`, {
    headers: { Cookie: operadorCookie },
  });

  const response = await api(`/ops/shipments/${createdCodigo}/arrive`, {
    method: 'POST',
    headers: { Cookie: operadorCookie },
  });

  assert.equal(response.status, 200);
  const body = response.body;
  assert.equal(body.estado, 'en_sucursal');
  assert.equal(body.sucursalActualId, sucursalDestinoId);
  assert.equal(
    body.fechaEntregaEstimada,
    beforeArrive.body.fechaEntregaEstimada,
    'fechaEntregaEstimada no cambia en arrive',
  );
  const ultimo = body.ultimosEventos[body.ultimosEventos.length - 1];
  assert.equal(ultimo.tipo, 'escaneo_sucursal');
});

test('incident con observación corta responde 400', async () => {
  const response = await api(`/ops/shipments/${createdCodigo}/incident`, {
    method: 'POST',
    headers: { Cookie: operadorCookie },
    body: { observacion: 'abc' },
  });

  assert.equal(response.status, 400);
});

test('incident válido ⇢ 200 con_incidencia', async () => {
  const response = await api(`/ops/shipments/${createdCodigo}/incident`, {
    method: 'POST',
    headers: { Cookie: operadorCookie },
    body: { observacion: 'Se detectó daño en el empaque exterior' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.estado, 'con_incidencia');
  const ultimo = response.body.ultimosEventos[response.body.ultimosEventos.length - 1];
  assert.equal(ultimo.tipo, 'incidencia');
  assert.match(ultimo.descripcion, /empaque exterior/);
});

test('resolve-incident con resolución fuera del enum responde 400', async () => {
  const response = await api(`/ops/shipments/${createdCodigo}/resolve-incident`, {
    method: 'POST',
    headers: { Cookie: operadorCookie },
    body: { resolucion: 'entregado' },
  });

  assert.equal(response.status, 400);
});

test('resolve-incident en_sucursal ⇢ 200', async () => {
  const response = await api(`/ops/shipments/${createdCodigo}/resolve-incident`, {
    method: 'POST',
    headers: { Cookie: operadorCookie },
    body: { resolucion: 'en_sucursal', observacion: 'Reingresado a depósito' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.estado, 'en_sucursal');
  const ultimo = response.body.ultimosEventos[response.body.ultimosEventos.length - 1];
  assert.equal(ultimo.tipo, 'cambio_estado');
  assert.match(ultimo.descripcion, /Incidencia resuelta: en_sucursal/);
});

test('assign desde en_sucursal ⇢ 200 en_reparto', async () => {
  const response = await api(`/ops/shipments/${createdCodigo}/assign`, {
    method: 'POST',
    headers: { Cookie: operadorCookie },
    body: { repartidorId: 'REP-01', vehiculoId: 'VEH-01' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.estado, 'en_reparto');
  const repartidor = await db.collection('repartidores').findOne({ _id: 'REP-01' });
  assert.equal(repartidor.estado, 'en_reparto');
});

test('deliver desde en_reparto ⇢ 200 entregado y libera recursos', async () => {
  const response = await api(`/ops/shipments/${createdCodigo}/deliver`, {
    method: 'POST',
    headers: { Cookie: operadorCookie },
  });

  assert.equal(response.status, 200);
  const body = response.body;
  assert.equal(body.estado, 'entregado');
  assert.equal(body.sucursalActualId, sucursalDestinoId);
  assert.ok(body.fechaEntrega, 'fechaEntrega seteada');
  const ultimo = body.ultimosEventos[body.ultimosEventos.length - 1];
  assert.equal(ultimo.tipo, 'entrega');

  const repartidor = await db.collection('repartidores').findOne({ _id: 'REP-01' });
  assert.equal(repartidor.estado, 'disponible');
  const vehiculo = await db.collection('vehiculos').findOne({ _id: 'VEH-01' });
  assert.equal(vehiculo.cargaActualKg, 0);
});

test('entregado es terminal: deliver y dispatch responden 409', async () => {
  const deliver = await api(`/ops/shipments/${createdCodigo}/deliver`, {
    method: 'POST',
    headers: { Cookie: operadorCookie },
  });
  assert.equal(deliver.status, 409);

  const dispatch = await api(`/ops/shipments/${createdCodigo}/dispatch`, {
    method: 'POST',
    headers: { Cookie: operadorCookie },
  });
  assert.equal(dispatch.status, 409);
});

test('bucket EVB del día escrito en eventos_seguimiento, eventos en orden', async () => {
  const day = new Date().toISOString().slice(0, 10);
  const bucket = await db
    .collection('eventos_seguimiento')
    .findOne({ _id: `EVB-${createdEnvioId}-${day}` });

  assert.ok(bucket, 'existe el bucket del día para el envío');
  assert.equal(bucket.envioId, createdEnvioId);
  assert.equal(bucket.cantidadEventos, 8);
  assert.deepEqual(
    bucket.eventos.map((evento) => evento.tipo),
    [
      'asignacion_reparto',
      'asignacion_reparto',
      'cambio_estado',
      'escaneo_sucursal',
      'incidencia',
      'cambio_estado',
      'asignacion_reparto',
      'entrega',
    ],
  );
  assert.deepEqual(
    bucket.eventos.map((evento) => evento.estado),
    [
      'pendiente',
      'pendiente',
      'en_transito',
      'en_sucursal',
      'con_incidencia',
      'en_sucursal',
      'en_reparto',
      'entregado',
    ],
  );
  for (const evento of bucket.eventos) {
    assert.ok(evento.timestamp instanceof Date, 'timestamp es Date');
    assert.equal(evento.ubicacion, null);
    assert.ok('repartidorId' in evento);
    assert.ok('sucursalId' in evento);
    assert.ok('observacion' in evento);
  }
});

test('capacidad insuficiente: 409 con mensaje de capacidad (VEH-04, 50 kg)', async () => {
  const created = await api('/shipments', {
    method: 'POST',
    headers: { Cookie: sessionCookie },
    body: heavyBody,
  });

  assert.equal(created.status, 201);
  const codigo = created.body.codigo;
  assert.equal(created.body.pesoTotalKg, 60);
  const doc = await db.collection('envios').findOne({ codigo });
  trackedEnvioIds.push(doc._id);

  const response = await api(`/ops/shipments/${codigo}/assign`, {
    method: 'POST',
    headers: { Cookie: operadorCookie },
    body: { repartidorId: 'REP-01', vehiculoId: 'VEH-04' },
  });

  assert.equal(response.status, 409);
  assert.match(String(response.body.message), /capacidad/i);

  // El rechazo no muta recursos
  const vehiculo = await db.collection('vehiculos').findOne({ _id: 'VEH-04' });
  assert.equal(vehiculo.cargaActualKg ?? 0, 0);
  const repartidor = await db.collection('repartidores').findOne({ _id: 'REP-01' });
  assert.equal(repartidor.estado, 'disponible');
});

test('repartidor no disponible (REP-02 en_ruta) responde 409', async () => {
  const created = await api('/shipments', {
    method: 'POST',
    headers: { Cookie: sessionCookie },
    body: validBody,
  });

  assert.equal(created.status, 201);
  trackedEnvioIds.push(
    (await db.collection('envios').findOne({ codigo: created.body.codigo }))._id,
  );

  const response = await api(`/ops/shipments/${created.body.codigo}/assign`, {
    method: 'POST',
    headers: { Cookie: operadorCookie },
    body: { repartidorId: 'REP-02', vehiculoId: 'VEH-01' },
  });

  assert.equal(response.status, 409);
  assert.match(String(response.body.message), /no está disponible/i);
});

test('envío cancelado por el cliente: toda acción operador responde 409', async () => {
  const created = await api('/shipments', {
    method: 'POST',
    headers: { Cookie: sessionCookie },
    body: validBody,
  });

  assert.equal(created.status, 201);
  const codigo = created.body.codigo;
  trackedEnvioIds.push(
    (await db.collection('envios').findOne({ codigo }))._id,
  );

  const cancel = await api(`/shipments/${codigo}/cancel`, {
    method: 'POST',
    headers: { Cookie: sessionCookie },
    body: { motivo: 'Cambio de planes, no procederá el envío' },
  });
  assert.equal(cancel.status, 200);
  assert.equal(cancel.body.cancelado, true);

  for (const action of ['dispatch', 'arrive', 'deliver']) {
    const response = await api(`/ops/shipments/${codigo}/${action}`, {
      method: 'POST',
      headers: { Cookie: operadorCookie },
    });
    assert.equal(response.status, 409, `${action} sobre cancelado`);
    assert.match(String(response.body.message), /cancelado/i);
  }

  const assign = await api(`/ops/shipments/${codigo}/assign`, {
    method: 'POST',
    headers: { Cookie: operadorCookie },
    body: { repartidorId: 'REP-01', vehiculoId: 'VEH-01' },
  });
  assert.equal(assign.status, 409);
  assert.match(String(assign.body.message), /cancelado/i);

  const incident = await api(`/ops/shipments/${codigo}/incident`, {
    method: 'POST',
    headers: { Cookie: operadorCookie },
    body: { observacion: 'intento sobre envío cancelado' },
  });
  assert.equal(incident.status, 409);
});

test('assign con repartidor inexistente ⇢ 400; vehículo inexistente ⇢ 400', async () => {
  const created = await api('/shipments', {
    method: 'POST',
    headers: { Cookie: sessionCookie },
    body: validBody,
  });

  assert.equal(created.status, 201);
  const codigo = created.body.codigo;
  trackedEnvioIds.push(
    (await db.collection('envios').findOne({ codigo }))._id,
  );

  const noRepartidor = await api(`/ops/shipments/${codigo}/assign`, {
    method: 'POST',
    headers: { Cookie: operadorCookie },
    body: { repartidorId: 'REP-99', vehiculoId: 'VEH-01' },
  });
  assert.equal(noRepartidor.status, 400);

  const noVehiculo = await api(`/ops/shipments/${codigo}/assign`, {
    method: 'POST',
    headers: { Cookie: operadorCookie },
    body: { repartidorId: 'REP-01', vehiculoId: 'VEH-99' },
  });
  assert.equal(noVehiculo.status, 400);
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
