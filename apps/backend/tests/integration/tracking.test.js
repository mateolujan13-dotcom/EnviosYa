const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { NestFactory } = require('@nestjs/core');

const { AppModule } = require(path.join(__dirname, '..', '..', 'dist', 'app.module'));
const { configureApp } = require(path.join(__dirname, '..', '..', 'dist', 'app.setup'));

let app;
let baseUrl;

before(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
});

after(async () => {
  if (app) {
    await app.close();
  }
});

test('GET /api/shipments/track/EY-4F8A1C responde 200 sin exponer PII', async () => {
  const response = await api('/shipments/track/EY-4F8A1C');

  assert.equal(response.status, 200);

  const { body, raw } = response;
  assert.equal(body.codigo, 'EY-4F8A1C');
  assert.equal(typeof body.estado, 'string');
  assert.ok(body.estado.length > 0);
  assert.equal(typeof body.origen.ciudad, 'string');
  assert.ok(body.origen.ciudad.length > 0);
  assert.equal(typeof body.origen.provincia, 'string');
  assert.equal(typeof body.destino.ciudad, 'string');
  assert.ok(body.destino.ciudad.length > 0);
  assert.equal(typeof body.destino.provincia, 'string');
  assert.equal(typeof body.totalPaquetes, 'number');
  assert.equal(typeof body.pesoTotalKg, 'number');
  assert.equal(typeof body.totalEventos, 'number');
  assert.equal(typeof body.fechaCreacion, 'string');
  assert.ok(body.fechaEntrega === null || typeof body.fechaEntrega === 'string');

  assert.ok(Array.isArray(body.ultimosEventos));
  assert.ok(body.ultimosEventos.length <= 5);
  const timestamps = body.ultimosEventos.map((evento) => Date.parse(evento.timestamp));
  for (let i = 1; i < timestamps.length; i += 1) {
    assert.ok(
      timestamps[i] > timestamps[i - 1],
      'ultimosEventos debe venir en orden ascendente por timestamp',
    );
  }

  // Aserciones negativas sobre el TEXTO CRUDO del JSON (sin parsear).
  const forbiddenTokens = [
    'clienteResumen',
    'remitente',
    'costo',
    'clienteId',
    'repartidorId',
    'RepartidorResumen',
    'repartidorResumen',
    'vehiculoId',
    'email',
    'telefono',
    '@',
  ];
  for (const token of forbiddenTokens) {
    assert.ok(
      !raw.includes(token),
      `la respuesta no debe incluir ${token}`,
    );
  }
  // La descripcion seed "Entregado al destinatario" es texto libre: el campo PII
  // se verifica como clave JSON ("destinatario" entre comillas) y como ausencia de key.
  assert.ok(!raw.includes('"destinatario"'), 'la respuesta no debe incluir la clave destinatario');
  assert.ok(!('destinatario' in body), 'el body parseado no debe exponer destinatario');
  assert.ok(!raw.includes('"_id"'), 'la respuesta no debe incluir la clave _id');
});

test('códigos con formato inválido responden 400 con el mismo mensaje', async () => {
  const invalidCodes = ['EY-4f8a1c', 'EY-123', 'EY-4F8A1CX', 'XX-4F8A1C', 'EY_4F8A1C'];
  let firstMessage;

  for (const code of invalidCodes) {
    const response = await api(`/shipments/track/${code}`);
    assert.equal(response.status, 400, `${code} debe responder 400`);
    assert.equal(typeof response.body.message, 'string');
    if (firstMessage === undefined) {
      firstMessage = response.body.message;
    } else {
      assert.equal(response.body.message, firstMessage, 'el mensaje 400 debe ser idéntico en todos los casos');
    }
  }
});

test('EY-ZZZZZZ (formato válido, inexistente en el seed) responde 404 con el mismo mensaje que el 400', async () => {
  // Confirmado contra la base TP9: EY-ZZZZZZ no existe en la colección envios.
  const badFormat = await api('/shipments/track/EY-123');
  assert.equal(badFormat.status, 400);

  const response = await api('/shipments/track/EY-ZZZZZZ');
  assert.equal(response.status, 404);
  assert.equal(response.body.message, badFormat.body.message);
});

test('la respuesta incluye Cache-Control public y max-age=60', async () => {
  const response = await api('/shipments/track/EY-4F8A1C');
  const cacheControl = response.headers['cache-control'] ?? '';

  assert.ok(cacheControl.includes('public'), 'Cache-Control debe incluir public');
  assert.ok(cacheControl.includes('max-age=60'), 'Cache-Control debe incluir max-age=60');
});

test('totalEventos coincide con el seed y el timeline viene ordenado (EY-4F8A1C=7, EY-7K2M9Q=9, EY-1B3C5D=5)', async () => {
  const seededCodes = [
    ['EY-4F8A1C', 7],
    ['EY-7K2M9Q', 9],
    ['EY-1B3C5D', 5],
  ];

  for (const [code, expectedTotalEventos] of seededCodes) {
    const response = await api(`/shipments/track/${code}`);

    assert.equal(response.status, 200, `${code} debe responder 200`);
    assert.equal(response.body.totalEventos, expectedTotalEventos);
    assert.equal(response.body.ultimosEventos.length, Math.min(5, expectedTotalEventos));

    const timestamps = response.body.ultimosEventos.map((evento) => Date.parse(evento.timestamp));
    for (let i = 1; i < timestamps.length; i += 1) {
      assert.ok(
        timestamps[i] > timestamps[i - 1],
        `${code}: ultimosEventos debe venir en orden ascendente por timestamp`,
      );
    }
  }
});

async function api(pathname) {
  const response = await fetch(`${baseUrl}/api${pathname}`, { method: 'GET' });
  const raw = await response.text();
  const body = raw ? JSON.parse(raw) : null;

  return {
    status: response.status,
    body,
    raw,
    headers: Object.fromEntries(response.headers.entries()),
  };
}
