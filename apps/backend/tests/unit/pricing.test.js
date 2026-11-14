const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  ServiceUnavailableException,
} = require('@nestjs/common');

const {
  PricingService,
} = require(path.join(__dirname, '..', '..', 'dist', 'pricing', 'pricing.service'));

const TARIFA = {
  _id: 'TAR-ESTANDAR',
  nombre: 'Tarifa Estándar',
  precioBase: 3500,
  precioKm: 180,
  precioKg: 250,
  recargoFragilPorcentaje: 10,
  tasaSeguroPorcentaje: 1,
  alicuotaIva: 21,
  moneda: 'ARS',
  vigenteDesde: new Date('2026-11-01T00:00:00.000Z'),
  activa: true,
  schemaVersion: 1,
};

const coords = { lat: -34.6037, lng: -58.3816 };

function createService({ tarifa = TARIFA, route } = {}) {
  const pricing = { findActiva: async () => tarifa };
  const geo = {
    geocodeAddress: async () => coords,
    getDrivingRoute: async () => route,
  };

  return new PricingService(pricing, geo);
}

const direccion = (ciudad) => ({
  calle: 'Av. Corrientes',
  numero: '1234',
  ciudad,
  provincia: 'Buenos Aires',
  cp: '1043',
});

const paquete = ({ pesoKg, fragil = false, valorDeclarado, dimensiones }) => ({
  descripcion: 'Caja',
  pesoKg,
  dimensiones: dimensiones ?? { altoCm: 10, anchoCm: 20, profundoCm: 30 },
  fragil,
  ...(valorDeclarado !== undefined
    ? { caracteristicas: [{ k: 'valorDeclarado', v: valorDeclarado }] }
    : {}),
});

test('desglose completo con un bulto sin frágil ni valor declarado', async () => {
  const service = createService({
    route: { distanciaKm: 650.5, duracionEstimadaHoras: 8.25, distanciaEstimada: false },
  });

  const result = await service.quote({
    origen: direccion('CABA'),
    destino: direccion('Córdoba'),
    paquetes: [paquete({ pesoKg: 5 })],
  });

  assert.equal(result.distanciaEstimada, false);
  assert.equal(result.pesoTotalKg, 5);
  assert.equal(result.volumenTotalM3, 0.006);
  assert.equal(result.moneda, 'ARS');
  assert.deepEqual(result.desglose, {
    precioBase: 3500,
    adicionalDistancia: 117090,
    adicionalPeso: 1250,
    adicionalFragil: 0,
    seguro: 0,
    subtotal: 121840,
    iva: 25586.4,
    total: 147426.4,
  });
});

test('frágil aplica una vez sobre el flete y seguro sobre Σ valor declarado', async () => {
  const service = createService({
    route: { distanciaKm: 700, duracionEstimadaHoras: 8, distanciaEstimada: false },
  });

  const result = await service.quote({
    origen: direccion('CABA'),
    destino: direccion('Rosario'),
    paquetes: [
      paquete({ pesoKg: 5, fragil: true, valorDeclarado: 120000 }),
      // valor declarado como string: también debe sumar
      paquete({ pesoKg: 3, valorDeclarado: '45000' }),
    ],
  });

  assert.equal(result.pesoTotalKg, 8);
  assert.deepEqual(result.desglose, {
    precioBase: 3500,
    adicionalDistancia: 126000,
    adicionalPeso: 2000,
    adicionalFragil: 13150,
    seguro: 1650,
    subtotal: 146300,
    iva: 30723,
    total: 177023,
  });
});

test('sin tarifa activa responde 503', async () => {
  const service = createService({
    tarifa: null,
    route: { distanciaKm: 10, duracionEstimadaHoras: 1, distanciaEstimada: false },
  });

  await assert.rejects(
    () =>
      service.quote({
        origen: direccion('CABA'),
        destino: direccion('Córdoba'),
        paquetes: [paquete({ pesoKg: 1 })],
      }),
    ServiceUnavailableException,
  );
});

test('distanciaEstimada se propaga desde el fallback Haversine', async () => {
  const service = createService({
    route: { distanciaKm: 100, duracionEstimadaHoras: 1.25, distanciaEstimada: true },
  });

  const result = await service.quote({
    origen: direccion('CABA'),
    destino: direccion('La Plata'),
    paquetes: [paquete({ pesoKg: 1 })],
  });

  assert.equal(result.distanciaEstimada, true);
});

test('volumen y peso suman todos los bultos', async () => {
  const service = createService({
    route: { distanciaKm: 10, duracionEstimadaHoras: 0.5, distanciaEstimada: false },
  });

  const result = await service.quote({
    origen: direccion('CABA'),
    destino: direccion('Rosario'),
    paquetes: [
      paquete({ pesoKg: 2, dimensiones: { altoCm: 10, anchoCm: 10, profundoCm: 10 } }),
      paquete({ pesoKg: 4.5, dimensiones: { altoCm: 40, anchoCm: 50, profundoCm: 35 } }),
    ],
  });

  assert.equal(result.pesoTotalKg, 6.5);
  assert.equal(result.volumenTotalM3, 0.071);
});
