/**
 * Carga idempotente de la tarifa inicial (P-004).
 *
 * La colección `tarifas` del TP9 existe (con $jsonSchema validator en
 * modo strict) pero está vacía en el seed; la app la siembra como sus
 * propias extensiones (igual que `usuarios`). Valores Stitch confirmados.
 *
 * Uso: npm run db:seed:tarifa --workspace=@envioya/backend
 */
const path = require('node:path');
const { NestFactory } = require('@nestjs/core');

const { AppModule } = require(path.join(__dirname, '..', 'dist', 'app.module'));
const {
  PricingRepository,
} = require(path.join(__dirname, '..', 'dist', 'repositories', 'pricing.repository'));

const TARIFA_ESTANDAR = {
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

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const pricing = app.get(PricingRepository);
    const existing = (await pricing.findAll()).find(
      (tarifa) => tarifa._id === TARIFA_ESTANDAR._id,
    );

    if (existing) {
      await pricing.updateOne(TARIFA_ESTANDAR._id, {
        $set: {
          nombre: TARIFA_ESTANDAR.nombre,
          precioBase: TARIFA_ESTANDAR.precioBase,
          precioKm: TARIFA_ESTANDAR.precioKm,
          precioKg: TARIFA_ESTANDAR.precioKg,
          recargoFragilPorcentaje: TARIFA_ESTANDAR.recargoFragilPorcentaje,
          tasaSeguroPorcentaje: TARIFA_ESTANDAR.tasaSeguroPorcentaje,
          alicuotaIva: TARIFA_ESTANDAR.alicuotaIva,
          moneda: TARIFA_ESTANDAR.moneda,
          vigenteDesde: TARIFA_ESTANDAR.vigenteDesde,
          activa: TARIFA_ESTANDAR.activa,
          schemaVersion: TARIFA_ESTANDAR.schemaVersion,
        },
      });
      console.log('Actualizada tarifa TAR-ESTANDAR');
    } else {
      await pricing.insertOne(TARIFA_ESTANDAR);
      console.log('Creada tarifa TAR-ESTANDAR');
    }

    console.log('\nSeed de tarifa completado.');
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error('No se pudo ejecutar el seed:', error.message);
  process.exit(1);
});
