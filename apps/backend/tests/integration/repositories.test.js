const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { NestFactory } = require('@nestjs/core');

const { AppModule } = require(path.join(__dirname, '..', '..', 'dist', 'app.module'));
const {
  MongoDatabaseService,
} = require(path.join(__dirname, '..', '..', 'dist', 'database', 'mongo-database.service'));
const {
  ShipmentsRepository,
} = require(path.join(__dirname, '..', '..', 'dist', 'repositories', 'shipments.repository'));
const {
  BranchesRepository,
} = require(path.join(__dirname, '..', '..', 'dist', 'repositories', 'branches.repository'));
const {
  ClientsRepository,
} = require(path.join(__dirname, '..', '..', 'dist', 'repositories', 'clients.repository'));
const {
  FleetRepository,
} = require(path.join(__dirname, '..', '..', 'dist', 'repositories', 'fleet.repository'));
const {
  PricingRepository,
} = require(path.join(__dirname, '..', '..', 'dist', 'repositories', 'pricing.repository'));
const {
  UsersRepository,
} = require(path.join(__dirname, '..', '..', 'dist', 'repositories', 'users.repository'));

const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
const tempTarifaId = `TAR-TEST-${suffix}`;
const tempUserId = `USR-TEST-${suffix}`;
const tempUserEmail = `test-${suffix}@envioya.test`;

let app;
let db;
let shipments;
let branches;
let clients;
let fleet;
let pricing;
let users;

before(async () => {
  app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  db = app.get(MongoDatabaseService).getDb();
  shipments = app.get(ShipmentsRepository);
  branches = app.get(BranchesRepository);
  clients = app.get(ClientsRepository);
  fleet = app.get(FleetRepository);
  pricing = app.get(PricingRepository);
  users = app.get(UsersRepository);
});

after(async () => {
  if (db) {
    await db.collection('tarifas').deleteMany({ _id: tempTarifaId });
    await db.collection('usuarios').deleteMany({ email: tempUserEmail });
  }
  if (app) {
    await app.close();
  }
});

test('conecta a la base envioya y responde ping', async () => {
  assert.equal(db.databaseName, 'envioya');
  const ping = await db.command({ ping: 1 });
  assert.equal(ping.ok, 1);
});

test('ShipmentsRepository lee los envíos preexistentes del TP9', async () => {
  const page = await shipments.findAll({}, 1, 5);

  assert.ok(page.total > 0, 'debe haber envíos del TP9');
  assert.equal(page.items.length, Math.min(5, page.total));

  const first = page.items[0];
  assert.ok(first.codigo.startsWith('EY-'));
  assert.ok(first.costo.total > 0);

  const byCodigo = await shipments.findByCodigo(first.codigo);
  assert.equal(byCodigo?._id, first._id);

  const porEstado = await shipments.countByEstado();
  assert.ok(porEstado.entregado > 0, 'debe haber envíos entregados');
});

test('BranchesRepository lee sucursales y filtra por ciudad', async () => {
  const sucursales = await branches.findAll();
  assert.ok(sucursales.length > 0);

  const caba = await branches.findByCiudad('CABA');
  assert.ok(caba.some((sucursal) => sucursal._id === 'SUC-01'));

  const activas = await branches.findAll({ soloActivas: true });
  assert.ok(activas.every((sucursal) => sucursal.activa === true));

  const porCiudad = await branches.countByCiudad();
  assert.ok(porCiudad.CABA >= 1);
});

test('ClientsRepository lee clientes y busca por email', async () => {
  const cliente = await clients.findByEmail('mgomez@andeslogistica.com.ar');
  assert.equal(cliente?._id, 'CLI-0001');
  assert.equal(cliente?.contacto.email, 'mgomez@andeslogistica.com.ar');

  const search = await clients.findAll({ search: 'Andes' });
  assert.ok(search.total >= 1);
  assert.ok(search.items.some((item) => item._id === 'CLI-0001'));

  const porTipo = await clients.countByTipo();
  assert.ok(porTipo.corporativo >= 1);
});

test('FleetRepository lee vehículos y repartidores del TP9', async () => {
  const vehiculo = await fleet.findVehiculoById('VEH-01');
  assert.equal(vehiculo?.patente, 'AB123CD');

  const repartidor = await fleet.findRepartidorById('REP-01');
  assert.equal(repartidor?.documento, '30111222');

  const disponibles = await fleet.findVehiculosDisponibles(undefined, 1000);
  assert.ok(disponibles.length > 0);
  assert.ok(disponibles.every((item) => item.capacidadKg >= 1000));

  const choferes = await fleet.findRepartidoresDisponibles();
  assert.ok(choferes.every((item) => item.estado === 'disponible'));
});

test('PricingRepository inserta, lee y desactiva una tarifa', async () => {
  const tarifa = {
    _id: tempTarifaId,
    nombre: 'Tarifa de prueba',
    precioBase: 1000,
    precioKm: 100,
    precioKg: 50,
    recargoFragilPorcentaje: 10,
    tasaSeguroPorcentaje: 2,
    alicuotaIva: 21,
    moneda: 'ARS',
    vigenteDesde: new Date(Date.now() - 60 * 60 * 1000),
    activa: true,
    schemaVersion: 1,
  };

  await pricing.insertOne(tarifa);

  const activa = await pricing.findActiva();
  assert.equal(activa?._id, tempTarifaId);

  const updated = await pricing.updateOne(tempTarifaId, {
    $set: { activa: false },
  });
  assert.equal(updated, true);

  const despues = await pricing.findActiva();
  assert.notEqual(despues?._id, tempTarifaId);
});

test('UsersRepository respeta el índice único de email', async () => {
  const usuario = {
    _id: tempUserId,
    email: tempUserEmail,
    passwordHash: 'hash-de-prueba-1234',
    nombre: 'Usuario de Prueba',
    rol: 'cliente',
    activo: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await users.insertOne(usuario);

  const encontrado = await users.findByEmail(tempUserEmail.toUpperCase());
  assert.equal(encontrado?._id, tempUserId);

  await assert.rejects(
    users.insertOne({ ...usuario, _id: `${tempUserId}-DUP` }),
    (error) => error.code === 11000,
  );
});

test('los validators e índices de la app siguen activos', async () => {
  const collections = await db.listCollections().toArray();
  const options = new Map(
    collections.map((collection) => [collection.name, collection.options]),
  );

  assert.ok(options.get('envios')?.validator?.$jsonSchema);
  assert.equal(options.get('envios')?.validationLevel, 'strict');
  assert.ok(options.get('usuarios')?.validator?.$jsonSchema);
  assert.ok(options.get('tarifas')?.validator?.$jsonSchema);

  const userIndexes = await db.collection('usuarios').indexes();
  const emailIndex = userIndexes.find((index) => index.name === 'idx_email_unique');
  assert.equal(emailIndex?.unique, true);

  const tarifaIndexes = await db.collection('tarifas').indexes();
  assert.ok(
    tarifaIndexes.some((index) => index.name === 'ix_tarifas_activa_vigencia'),
  );
});
