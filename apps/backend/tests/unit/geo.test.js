const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  GeoService,
  HAVERSINE_ROUTE_FACTOR,
  ASSUMED_SPEED_KMH,
} = require(path.join(__dirname, '..', '..', 'dist', 'geo', 'geo.service'));
// Factor acordado en ADR-005: Haversine x 1.25. Se hardcodea para que el
// test muerda: un cambio en el factor del servicio rompe este assert.
const ADR_005_ROUTE_FACTOR = 1.25;
const {
  haversineKm,
} = require(path.join(__dirname, '..', '..', 'dist', 'geo', 'haversine'));
const {
  TtlCache,
} = require(path.join(__dirname, '..', '..', 'dist', 'geo', 'ttl-cache'));
const {
  BadRequestException,
  ServiceUnavailableException,
} = require('@nestjs/common');

// CABA (Obelisco aprox.) -> Córdoba (centro aprox.): ~648 km en línea recta.
const CABA = { lat: -34.6037, lng: -58.3816 };
const CORDOBA = { lat: -31.4201, lng: -64.1888 };

const direccionCaba = {
  calle: 'Av. Corrientes',
  numero: '1234',
  ciudad: 'CABA',
  provincia: 'Buenos Aires',
  cp: '1043',
};

test('haversineKm: distancia CABA -> Córdoba en el rango esperado', () => {
  const km = haversineKm(CABA, CORDOBA);
  assert.ok(km > 630 && km < 670, `distancia inesperada: ${km}`);
});

test('getDrivingRoute: usa OSRM y propaga distancia/duración', async () => {
  const service = new GeoService(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ routes: [{ distance: 700000, duration: 25200 }] }),
  }));

  const route = await service.getDrivingRoute(CABA, CORDOBA);

  assert.equal(route.distanciaEstimada, false);
  assert.equal(route.distanciaKm, 700);
  assert.equal(route.duracionEstimadaHoras, 7);
});

test('getDrivingRoute: OSRM caído degrada a Haversine x 1.25 con flag estimada', async () => {
  const service = new GeoService(async () => {
    throw new Error('ECONNREFUSED');
  });

  const route = await service.getDrivingRoute(CABA, CORDOBA);

  assert.equal(HAVERSINE_ROUTE_FACTOR, ADR_005_ROUTE_FACTOR);
  const expected = haversineKm(CABA, CORDOBA) * ADR_005_ROUTE_FACTOR;
  assert.equal(route.distanciaEstimada, true);
  assert.ok(Math.abs(route.distanciaKm - expected) < 1e-9);
  assert.ok(Math.abs(route.duracionEstimadaHoras - expected / ASSUMED_SPEED_KMH) < 1e-9);
});

test('getDrivingRoute: OSRM 500 degrada a Haversine x 1.25', async () => {
  const service = new GeoService(async () => ({
    ok: false,
    status: 500,
    json: async () => ({ message: 'boom' }),
  }));

  const route = await service.getDrivingRoute(CABA, CORDOBA);

  assert.equal(route.distanciaEstimada, true);
});

test('getDrivingRoute: segunda llamada idéntica no vuelve a llamar fetch (caché)', async () => {
  let calls = 0;
  const service = new GeoService(async () => {
    calls += 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({ routes: [{ distance: 100000, duration: 3600 }] }),
    };
  });

  const first = await service.getDrivingRoute(CABA, CORDOBA);
  const second = await service.getDrivingRoute(CABA, CORDOBA);

  assert.equal(calls, 1);
  assert.deepEqual(first, second);
});

test('geocodeAddress: hits de Nominatim se parsean y se cachean', async () => {
  let calls = 0;
  const service = new GeoService(async () => {
    calls += 1;
    return {
      ok: true,
      status: 200,
      json: async () => [{ lat: '-34.6045', lon: '-58.3959' }],
    };
  });

  const first = await service.geocodeAddress(direccionCaba);
  const second = await service.geocodeAddress(direccionCaba);

  assert.equal(calls, 1);
  assert.deepEqual(first, { lat: -34.6045, lng: -58.3959 });
  assert.deepEqual(second, first);
});

test('geocodeAddress: Nominatim con 0 resultados responde 400', async () => {
  const service = new GeoService(async () => ({
    ok: true,
    status: 200,
    json: async () => [],
  }));

  await assert.rejects(() => service.geocodeAddress(direccionCaba), BadRequestException);
});

test('geocodeAddress: Nominatim caído responde 503', async () => {
  const service = new GeoService(async () => {
    throw new Error('network down');
  });

  await assert.rejects(
    () => service.geocodeAddress(direccionCaba),
    ServiceUnavailableException,
  );
});

test('TtlCache: expirado y capacidad máxima', async () => {
  const cache = new TtlCache(2, 10);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  assert.equal(cache.size, 2);
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.get('c'), 3);

  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(cache.get('b'), undefined, 'la entrada debe expirar por TTL');
});
