/**
 * Verificación de solo lectura de la base `envioya`.
 *
 * Comprueba que:
 *  - Las colecciones del TP9 existen y tienen datos.
 *  - Los validators nativos (`envios`) siguen intactos.
 *  - Las colecciones de la app (`usuarios`, `tarifas`) tienen validator e índices.
 *
 * Uso: npm run db:verify --workspace=@envioya/backend
 */
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

loadEnvFile(path.join(__dirname, '..', '.env'));

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB_NAME || 'envioya';

const REQUIRED_TP9_COLLECTIONS = [
  'envios',
  'clientes',
  'sucursales',
  'repartidores',
  'vehiculos',
  'rutas',
  'asignaciones_rutas',
  'eventos_seguimiento',
  'facturas',
];

const APP_COLLECTIONS = ['usuarios', 'tarifas'];

async function main() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(dbName);

  const collectionList = await db.listCollections().toArray();
  const infoByName = new Map(
    collectionList.map((collection) => [collection.name, collection]),
  );

  const errors = [];
  const warnings = [];
  const counts = {};

  console.log(`\nBase de datos: ${dbName}`);
  console.log(`Conexión: ${uri}\n`);

  for (const name of REQUIRED_TP9_COLLECTIONS) {
    if (!infoByName.has(name)) {
      errors.push(`Falta la colección del TP9 \`${name}\``);
      continue;
    }

    const count = await db.collection(name).estimatedDocumentCount();
    counts[name] = count;
    if (count === 0) {
      errors.push(`La colección \`${name}\` está vacía`);
    }
  }

  for (const name of APP_COLLECTIONS) {
    if (!infoByName.has(name)) {
      warnings.push(
        `La colección de la app \`${name}\` no existe todavía (se crea al iniciar el backend)`,
      );
      continue;
    }

    const count = await db.collection(name).estimatedDocumentCount();
    counts[name] = count;

    const info = infoByName.get(name);
    if (!info.options || !info.options.validator) {
      errors.push(`La colección \`${name}\` no tiene validator`);
    }
  }

  validateEnviosSchema(infoByName.get('envios'), errors);

  if (infoByName.has('usuarios')) {
    await validateUniqueIndex(
      db,
      'usuarios',
      'idx_email_unique',
      errors,
    );
  }

  if (infoByName.has('tarifas')) {
    await validateIndex(
      db,
      'tarifas',
      'ix_tarifas_activa_vigencia',
      errors,
    );
  }

  const sampleEnvio = await db
    .collection('envios')
    .findOne({}, { projection: { _id: 1, codigo: 1, estado: 1, 'costo.total': 1 } });
  const sampleCliente = await db
    .collection('clientes')
    .findOne({}, { projection: { _id: 1, razonSocial: 1, 'contacto.email': 1 } });

  if (!sampleEnvio) errors.push('No se pudo leer un envío de muestra');
  if (!sampleCliente) errors.push('No se pudo leer un cliente de muestra');

  console.log('Colecciones y documentos:');
  for (const [name, count] of Object.entries(counts).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    console.log(`  ${name.padEnd(22)} ${count}`);
  }

  if (sampleEnvio) {
    console.log(
      `\nMuestra de envío: ${sampleEnvio._id} (${sampleEnvio.codigo}) · ${sampleEnvio.estado} · $${sampleEnvio.costo?.total ?? '?'}`,
    );
  }
  if (sampleCliente) {
    console.log(
      `Muestra de cliente: ${sampleCliente._id} · ${sampleCliente.razonSocial} · ${sampleCliente.contacto?.email ?? 'sin email'}`,
    );
  }

  for (const warning of warnings) {
    console.warn(`\nADVERTENCIA: ${warning}`);
  }
  for (const error of errors) {
    console.error(`\nERROR: ${error}`);
  }

  await client.close();

  if (errors.length > 0) {
    console.error(`\nVerificación FALLIDA (${errors.length} error(es)).`);
    process.exit(1);
  }

  console.log('\nVerificación OK: datos del TP9 y validators intactos.');
}

function validateEnviosSchema(info, errors) {
  if (!info) return;

  const validator = info.options && info.options.validator;
  if (!validator || !validator.$jsonSchema) {
    errors.push('La colección `envios` perdió su validator $jsonSchema');
    return;
  }

  const required = validator.$jsonSchema.required || [];
  if (!required.includes('costo') || !required.includes('codigo')) {
    errors.push('El validator de `envios` no contiene los campos esperados');
  }

  if (info.options.validationLevel !== 'strict') {
    errors.push('El validator de `envios` no está en validationLevel: strict');
  }
}

async function validateUniqueIndex(db, collection, indexName, errors) {
  const indexes = await safeIndexes(db, collection);
  const index = indexes.find((item) => item.name === indexName);

  if (!index) {
    errors.push(`Falta el índice \`${indexName}\` en \`${collection}\``);
  } else if (!index.unique) {
    errors.push(`El índice \`${indexName}\` no es único`);
  }
}

async function validateIndex(db, collection, indexName, errors) {
  const indexes = await safeIndexes(db, collection);
  if (!indexes.some((item) => item.name === indexName)) {
    errors.push(`Falta el índice \`${indexName}\` en \`${collection}\``);
  }
}

async function safeIndexes(db, collection) {
  try {
    return await db.collection(collection).indexes();
  } catch {
    return [];
  }
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;

    const key = match[1];
    if (process.env[key] !== undefined) continue;

    process.env[key] = match[2].replace(/^["']|["']$/g, '');
  }
}

main().catch((error) => {
  console.error('\nNo se pudo verificar la base de datos:', error.message);
  process.exit(1);
});
