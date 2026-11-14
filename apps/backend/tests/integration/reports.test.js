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
const comaEmail = `cliente-reports-comma-${suffix}@envioya.test`;
const formulaEmail = `cliente-reports-formula-${suffix}@envioya.test`;
const comillasEmail = `cliente-reports-comillas-${suffix}@envioya.test`;
const operadorEmail = `operador-reports-${suffix}@envioya.test`;
const password = 'ClaveSegura123';
const operadorPassword = 'OperadorSeguro123';

// Geocodificación y ruta mockeadas: el test no sale a la red.
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
  destinatario: { nombre: 'Destinatario Reports', telefono: '+54 351 555-0011' },
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

// Nombre con coma: fuerza escaping RFC 4180 en el CSV.
const COMA_NOMBRE = 'Cliente, ComaDemo';
// Nombre con prefijo de fórmula: fuerza el guard anti-inyección en el CSV.
const FORMULA_NOMBRE = '=FormulaCSV';
// Nombre con comillas dobles: fuerza el escapeo RFC 4180 (comillas duplicadas).
const COMILLAS_NOMBRE = 'Cliente "Comillas" Demo';

const CSV_HEADER =
  'codigo,estado,cancelado,cliente,origenCiudad,destinoCiudad,totalPaquetes,pesoTotalKg,totalARS,fechaCreacion';

let app;
let db;
let baseUrl;
let clienteComaCookie = '';
let clienteComaId = '';
let formulaCookie = '';
let formulaClienteId = '';
let comillasCookie = '';
let comillasClienteId = '';
let operadorCookie = '';
const trackedEnvioIds = [];
let csvFrom = '';
let csvTo = '';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const round1 = (n) => Math.round((n + Number.EPSILON) * 10) / 10;

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

  csvFrom = new Date(Date.now() - 5000).toISOString();
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
      .deleteMany({ email: { $in: [comaEmail, formulaEmail, comillasEmail, operadorEmail] } });
    const clienteIds = [clienteComaId, formulaClienteId, comillasClienteId].filter(Boolean);
    if (clienteIds.length > 0) {
      await db.collection('clientes').deleteMany({ _id: { $in: clienteIds } });
    }
  }
  if (app) {
    await app.close();
  }
});

test('sin sesión responde 401 en /ops/reports', async () => {
  const response = await api('/ops/reports/resumen');
  assert.equal(response.status, 401);

  const csv = await api('/ops/reports/envios.csv');
  assert.equal(csv.status, 401);
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

test('registro de cliente efímero con coma en el nombre: cookie para los tests siguientes', async () => {
  const response = await api('/auth/register', {
    method: 'POST',
    body: {
      nombre: COMA_NOMBRE,
      email: comaEmail,
      telefono: '+54 11 5555-0110',
      password,
    },
  });

  assert.equal(response.status, 201);
  clienteComaId = response.body.usuario.clienteId;
  clienteComaCookie = extractCookie(response.setCookies);
  assert.ok(clienteComaCookie.startsWith('envioya_session='));
});

test('registro de cliente efímero con nombre prefijo de fórmula', async () => {
  const response = await api('/auth/register', {
    method: 'POST',
    body: {
      nombre: FORMULA_NOMBRE,
      email: formulaEmail,
      telefono: '+54 11 5555-0111',
      password,
    },
  });

  assert.equal(response.status, 201);
  formulaClienteId = response.body.usuario.clienteId;
  formulaCookie = extractCookie(response.setCookies);
  assert.ok(formulaCookie.startsWith('envioya_session='));
});

test('registro de cliente efímero con comillas en el nombre', async () => {
  const response = await api('/auth/register', {
    method: 'POST',
    body: {
      nombre: COMILLAS_NOMBRE,
      email: comillasEmail,
      telefono: '+54 11 5555-0112',
      password,
    },
  });

  assert.equal(response.status, 201);
  comillasClienteId = response.body.usuario.clienteId;
  comillasCookie = extractCookie(response.setCookies);
  assert.ok(comillasCookie.startsWith('envioya_session='));
});

test('alta de operador efímero + login: cookie con rol operador', async () => {
  const passwordHash = await bcrypt.hash(operadorPassword, 12);
  await db.collection('usuarios').insertOne({
    _id: `USR-OP-${suffix}`,
    email: operadorEmail,
    passwordHash,
    nombre: 'Operador Reports',
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

test('cliente autenticado no puede usar /ops/reports: responde 403', async () => {
  for (const route of [
    'resumen',
    'por-sucursal',
    'tiempos-promedio',
    'top-repartidores',
    'por-estado',
    'envios.csv',
  ]) {
    const response = await api(`/ops/reports/${route}`, {
      headers: { Cookie: clienteComaCookie },
    });
    assert.equal(response.status, 403, `${route} debe rechazar rol cliente`);
  }
});

test('from/to inválidas responden 400 en todos los endpoints de reportes', async () => {
  for (const route of [
    'resumen',
    'por-sucursal',
    'tiempos-promedio',
    'top-repartidores',
    'por-estado',
  ]) {
    const response = await api(`/ops/reports/${route}?from=not-a-date`, {
      headers: { Cookie: operadorCookie },
    });
    assert.equal(response.status, 400, `${route} debe rechazar from inválida`);
  }

  const csv = await rawApi('/ops/reports/envios.csv?from=2026-13-99', {
    headers: { Cookie: operadorCookie },
  });
  assert.equal(csv.status, 400, 'envios.csv debe rechazar from inválida');
});

test('crear 2 envíos efímeros (cliente coma), 1 (cliente fórmula) y 1 (cliente comillas) vía API', async () => {
  const first = await api('/shipments', {
    method: 'POST',
    headers: { Cookie: clienteComaCookie },
    body: validBody,
  });
  assert.equal(first.status, 201);

  const second = await api('/shipments', {
    method: 'POST',
    headers: { Cookie: clienteComaCookie },
    body: validBody,
  });
  assert.equal(second.status, 201);

  const third = await api('/shipments', {
    method: 'POST',
    headers: { Cookie: formulaCookie },
    body: validBody,
  });
  assert.equal(third.status, 201);

  const fourth = await api('/shipments', {
    method: 'POST',
    headers: { Cookie: comillasCookie },
    body: validBody,
  });
  assert.equal(fourth.status, 201);

  csvTo = new Date(Date.now() + 60000).toISOString();

  const docs = await db
    .collection('envios')
    .find({ clienteId: { $in: [clienteComaId, formulaClienteId, comillasClienteId] } })
    .toArray();
  assert.equal(docs.length, 4);
  trackedEnvioIds.push(...docs.map((doc) => doc._id));

  const secondDoc = docs.find((doc) => doc.codigo === second.body.codigo);

  const cancel = await api(`/shipments/${second.body.codigo}/cancel`, {
    method: 'POST',
    headers: { Cookie: clienteComaCookie },
    body: { motivo: 'Cancelado para verificar exclusiones en reportes' },
  });
  assert.equal(cancel.status, 200);
  assert.equal(cancel.body.cancelado, true);
  assert.ok(secondDoc, 'el segundo envío efímero existe en la base');
});

test('resumen coincide con re-conteo del driver (base completa)', async () => {
  const noCancelado = { cancelado: { $ne: true } };
  const [
    totalEnvios,
    cancelados,
    entregados,
    enTransito,
    enReparto,
    enSucursal,
    conIncidencia,
    devueltos,
  ] = await Promise.all([
    db.collection('envios').countDocuments({}),
    db.collection('envios').countDocuments({ cancelado: true }),
    db.collection('envios').countDocuments({ ...noCancelado, estado: 'entregado' }),
    db.collection('envios').countDocuments({ ...noCancelado, estado: 'en_transito' }),
    db.collection('envios').countDocuments({ ...noCancelado, estado: 'en_reparto' }),
    db.collection('envios').countDocuments({ ...noCancelado, estado: 'en_sucursal' }),
    db.collection('envios').countDocuments({ ...noCancelado, estado: 'con_incidencia' }),
    db.collection('envios').countDocuments({ ...noCancelado, estado: 'devuelto' }),
  ]);
  const gastoRows = await db
    .collection('envios')
    .aggregate([
      { $match: noCancelado },
      { $group: { _id: null, total: { $sum: '$costo.total' } } },
    ])
    .toArray();
  const gastoTotal = round2(gastoRows[0]?.total ?? 0);
  const noCancelados = totalEnvios - cancelados;
  const tasaEntrega = totalEnvios === 0 ? 0 : round2((entregados / totalEnvios) * 100);
  const ticketPromedio = noCancelados === 0 ? 0 : round2(gastoTotal / noCancelados);

  const response = await api('/ops/reports/resumen', {
    headers: { Cookie: operadorCookie },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    totalEnvios,
    entregados,
    enTransito,
    enReparto,
    enSucursal,
    conIncidencia,
    devueltos,
    cancelados,
    tasaEntrega,
    gastoTotal,
    ticketPromedio,
  });
});

test('resumen con sucursalId matchea origen o destino (re-conteo del driver)', async () => {
  const sample = await db
    .collection('envios')
    .findOne({ _id: { $in: trackedEnvioIds } });
  assert.ok(sample, 'hay envíos efímeros para filtrar');
  const sucursalId = sample.sucursalDestinoId;

  const noCancelado = { cancelado: { $ne: true } };
  const branch = {
    $or: [
      { sucursalOrigenId: sucursalId },
      { sucursalDestinoId: sucursalId },
    ],
  };
  const [totalEnvios, cancelados, entregados] = await Promise.all([
    db.collection('envios').countDocuments(branch),
    db.collection('envios').countDocuments({ ...branch, cancelado: true }),
    db.collection('envios').countDocuments({ ...branch, ...noCancelado, estado: 'entregado' }),
  ]);
  const gastoRows = await db
    .collection('envios')
    .aggregate([
      { $match: { ...branch, ...noCancelado } },
      { $group: { _id: null, total: { $sum: '$costo.total' } } },
    ])
    .toArray();
  const gastoTotal = round2(gastoRows[0]?.total ?? 0);
  const noCancelados = totalEnvios - cancelados;
  const tasaEntrega = totalEnvios === 0 ? 0 : round2((entregados / totalEnvios) * 100);
  const ticketPromedio = noCancelados === 0 ? 0 : round2(gastoTotal / noCancelados);

  const response = await api(`/ops/reports/resumen?sucursalId=${sucursalId}`, {
    headers: { Cookie: operadorCookie },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.totalEnvios, totalEnvios);
  assert.equal(response.body.cancelados, cancelados);
  assert.equal(response.body.entregados, entregados);
  assert.equal(response.body.tasaEntrega, tasaEntrega);
  assert.equal(response.body.gastoTotal, gastoTotal);
  assert.equal(response.body.ticketPromedio, ticketPromedio);
});

test('resumen con ventana from/to excluye documentos fuera de rango', async () => {
  const future = new Date(Date.now() + 86400000 * 30).toISOString();
  const response = await api(`/ops/reports/resumen?from=${encodeURIComponent(future)}`, {
    headers: { Cookie: operadorCookie },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.totalEnvios, 0);
  assert.equal(response.body.entregados, 0);
  assert.equal(response.body.tasaEntrega, 0);
  assert.equal(response.body.gastoTotal, 0);
  assert.equal(response.body.ticketPromedio, 0);
});

test('por-sucursal coincide con agregación del driver y respeta orden desc', async () => {
  const rows = await db
    .collection('envios')
    .aggregate([
      { $match: { cancelado: { $ne: true } } },
      {
        $group: {
          _id: '$sucursalDestinoId',
          cantidad: { $sum: 1 },
          entregados: {
            $sum: { $cond: [{ $eq: ['$estado', 'entregado'] }, 1, 0] },
          },
          totalARS: { $sum: '$costo.total' },
        },
      },
      { $sort: { cantidad: -1, _id: 1 } },
    ])
    .toArray();

  const sucursales = await db
    .collection('sucursales')
    .find({}, { projection: { nombre: 1 } })
    .toArray();
  const nombrePorId = new Map(sucursales.map((s) => [String(s._id), s.nombre]));

  const expected = rows
    .filter((row) => row._id)
    .map((row) => ({
      sucursalId: row._id,
      nombre: nombrePorId.get(String(row._id)) ?? String(row._id),
      cantidad: row.cantidad,
      entregados: row.entregados,
      totalARS: round2(row.totalARS),
    }));

  const response = await api('/ops/reports/por-sucursal', {
    headers: { Cookie: operadorCookie },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, expected);
  for (let i = 1; i < response.body.length; i += 1) {
    assert.ok(
      response.body[i - 1].cantidad >= response.body[i].cantidad,
      'orden descendente por cantidad',
    );
  }
});

test('tiempos-promedio coincide con el promedio recalculado del driver', async () => {
  const matchEntregados = {
    cancelado: { $ne: true },
    estado: 'entregado',
    fechaEntrega: { $ne: null },
  };
  const globalRows = await db
    .collection('envios')
    .aggregate([
      { $match: matchEntregados },
      {
        $group: {
          _id: null,
          promedioMs: { $avg: { $subtract: ['$fechaEntrega', '$fechaCreacion'] } },
        },
      },
    ])
    .toArray();
  const promedioEsperado = globalRows[0]?.promedioMs
    ? round1(globalRows[0].promedioMs / 3600000)
    : 0;

  const porSucursalRows = await db
    .collection('envios')
    .aggregate([
      { $match: matchEntregados },
      {
        $group: {
          _id: '$sucursalDestinoId',
          promedioMs: { $avg: { $subtract: ['$fechaEntrega', '$fechaCreacion'] } },
          entregados: { $sum: 1 },
        },
      },
      { $sort: { entregados: -1, _id: 1 } },
    ])
    .toArray();
  const sucursales = await db
    .collection('sucursales')
    .find({}, { projection: { nombre: 1 } })
    .toArray();
  const nombrePorId = new Map(sucursales.map((s) => [String(s._id), s.nombre]));
  const porSucursalEsperado = porSucursalRows
    .filter((row) => row._id)
    .map((row) => ({
      sucursalId: row._id,
      nombre: nombrePorId.get(String(row._id)) ?? String(row._id),
      promedioHoras: round1(row.promedioMs / 3600000),
      entregados: row.entregados,
    }));

  const response = await api('/ops/reports/tiempos-promedio', {
    headers: { Cookie: operadorCookie },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.promedioHoras, promedioEsperado);
  assert.deepEqual(response.body.porSucursal, porSucursalEsperado);
});

test('top-repartidores coincide con la agregación del driver (top 5 por entregas)', async () => {
  const rows = await db
    .collection('envios')
    .aggregate([
      {
        $match: {
          cancelado: { $ne: true },
          estado: 'entregado',
          repartidorId: { $ne: null },
        },
      },
      {
        $group: {
          _id: '$repartidorId',
          entregas: { $sum: 1 },
          totalPaquetes: { $sum: '$totalPaquetes' },
          pesoTotalKg: { $sum: '$pesoTotalKg' },
          totalARS: { $sum: '$costo.total' },
        },
      },
      { $sort: { entregas: -1, _id: 1 } },
      { $limit: 5 },
    ])
    .toArray();
  const repartidores = await db
    .collection('repartidores')
    .find({}, { projection: { nombre: 1 } })
    .toArray();
  const nombrePorId = new Map(repartidores.map((r) => [String(r._id), r.nombre]));
  const expected = rows.map((row) => ({
    repartidorId: row._id,
    nombre: nombrePorId.get(String(row._id)) ?? String(row._id),
    entregas: row.entregas,
    totalPaquetes: row.totalPaquetes,
    pesoTotalKg: round2(row.pesoTotalKg),
    totalARS: round2(row.totalARS),
  }));

  const response = await api('/ops/reports/top-repartidores', {
    headers: { Cookie: operadorCookie },
  });

  assert.equal(response.status, 200);
  assert.ok(response.body.length <= 5);
  assert.deepEqual(response.body, expected);
  for (let i = 1; i < response.body.length; i += 1) {
    assert.ok(
      response.body[i - 1].entregas >= response.body[i].entregas,
      'orden descendente por entregas',
    );
  }
});

test('por-estado coincide con countDocuments por estado (sin cancelados)', async () => {
  const estados = [
    'pendiente',
    'en_transito',
    'en_sucursal',
    'en_reparto',
    'entregado',
    'con_incidencia',
    'devuelto',
  ];
  const noCancelado = { cancelado: { $ne: true } };
  const response = await api('/ops/reports/por-estado', {
    headers: { Cookie: operadorCookie },
  });

  assert.equal(response.status, 200);
  assert.ok(
    response.body.every((entry) => entry.estado !== 'cancelado'),
    'los estados listados no incluyen cancelado',
  );

  for (const estado of estados) {
    const expected = await db
      .collection('envios')
      .countDocuments({ ...noCancelado, estado });
    const found = response.body.find((entry) => entry.estado === estado);
    if (expected === 0) {
      assert.equal(found, undefined, `${estado} ausente cuando no hay docs`);
    } else {
      assert.equal(found?.cantidad, expected, `${estado} coincide con countDocuments`);
    }
  }

  const totalEstados = response.body.reduce((acc, entry) => acc + entry.cantidad, 0);
  const totalNoCancelados = await db.collection('envios').countDocuments(noCancelado);
  assert.equal(totalEstados, totalNoCancelados);
});

test('envios.csv: streaming con BOM, header exacto, escaping y filas == filtro', async () => {
  const response = await rawApi(
    `/ops/reports/envios.csv?from=${encodeURIComponent(csvFrom)}&to=${encodeURIComponent(csvTo)}`,
    { headers: { Cookie: operadorCookie } },
  );

  assert.equal(response.status, 200);
  assert.match(response.contentType ?? '', /^text\/csv; charset=utf-8/);
  assert.match(
    response.contentDisposition ?? '',
    /^attachment; filename="envios-\d{12}\.csv"$/,
  );

  const text = response.text;
  assert.ok(text.startsWith('\uFEFF'), 'el CSV arranca con BOM uFEFF');

  const lines = text.split('\r\n').filter((line) => line.length > 0);
  assert.equal(lines[0].replace(/^\uFEFF/, ''), CSV_HEADER);

  assert.ok(
    lines.every((line) => !line.startsWith('=')),
    'ninguna línea empieza con = (guardia anti-inyección)',
  );

  const dataLines = lines.slice(1);
  const expectedRows = await db.collection('envios').countDocuments({
    fechaCreacion: { $gte: new Date(csvFrom), $lte: new Date(csvTo) },
  });
  assert.equal(dataLines.length, expectedRows, 'filas == documentos filtrados');

  assert.ok(
    dataLines.some((line) => line.includes('"Cliente, ComaDemo"')),
    'el nombre con coma aparece citado como campo RFC 4180',
  );
  assert.ok(
    dataLines.some((line) => line.includes("'=FormulaCSV")),
    'el nombre con prefijo = aparece con comilla simple antepuesta',
  );
  assert.ok(
    dataLines.some((line) => line.includes('"Cliente ""Comillas"" Demo"')),
    'el nombre con comillas dobles aparece con las comillas duplicadas (RFC 4180)',
  );

  const codigoPattern = /EY-[A-Z0-9]{6}/;
  assert.ok(dataLines.every((line) => codigoPattern.test(line)), 'cada fila tiene código');
});

test('envios.csv con ventana vacía responde 200 con header y sin filas', async () => {
  const future = new Date(Date.now() + 86400000 * 30).toISOString();
  const from = new Date(Date.now() + 86400000 * 31).toISOString();
  const response = await rawApi(
    `/ops/reports/envios.csv?from=${encodeURIComponent(from)}&to=${encodeURIComponent(future)}`,
    { headers: { Cookie: operadorCookie } },
  );

  assert.equal(response.status, 200);
  const lines = response.text.split('\r\n').filter((line) => line.length > 0);
  assert.equal(lines.length, 1, 'solo el header');
  assert.equal(lines[0].replace(/^\uFEFF/, ''), CSV_HEADER);
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

async function rawApi(pathname, options = {}) {
  const response = await fetch(`${baseUrl}/api${pathname}`, {
    method: options.method ?? 'GET',
    headers: { ...(options.headers ?? {}) },
  });

  // Buffer → texto: fetch .text() se tragaría el BOM (TextDecoder lo omite).
  const buffer = Buffer.from(await response.arrayBuffer());

  return {
    status: response.status,
    text: buffer.toString('utf8'),
    contentType: response.headers.get('content-type'),
    contentDisposition: response.headers.get('content-disposition'),
  };
}

function extractCookie(setCookies) {
  const session = setCookies.find((cookie) =>
    cookie.startsWith('envioya_session='),
  );

  return session ? session.split(';')[0] : '';
}
