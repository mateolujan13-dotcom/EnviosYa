/**
 * Carga idempotente de usuarios operativos.
 *
 * El registro público solo crea clientes. Operadores y administradores se
 * precargan con este script (ADR-003), usando bcrypt con 12 rounds.
 *
 * Uso: npm run db:seed --workspace=@envioya/backend
 */
const path = require('node:path');
const bcrypt = require('bcrypt');
const { NestFactory } = require('@nestjs/core');

const { AppModule } = require(path.join(__dirname, '..', 'dist', 'app.module'));
const {
  UsersRepository,
} = require(path.join(__dirname, '..', 'dist', 'repositories', 'users.repository'));
const {
  BCRYPT_ROUNDS,
} = require(path.join(__dirname, '..', 'dist', 'auth', 'auth.constants'));

const SEED_USERS = [
  {
    _id: 'USR-ADMIN-001',
    email: 'admin@envioya.com',
    nombre: 'Administrador EnvíoYa',
    rol: 'admin',
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin1234!',
  },
  {
    _id: 'USR-OPERADOR-001',
    email: 'operador@envioya.com',
    nombre: 'Operador EnvíoYa',
    rol: 'operador',
    password: process.env.SEED_OPERADOR_PASSWORD || 'Operador1234!',
  },
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const users = app.get(UsersRepository);

    for (const seed of SEED_USERS) {
      const existing = await users.findByEmail(seed.email);
      const passwordHash = await bcrypt.hash(seed.password, BCRYPT_ROUNDS);

      if (existing) {
        await users.updateOne(existing._id, {
          $set: {
            nombre: seed.nombre,
            rol: seed.rol,
            passwordHash,
            activo: true,
          },
        });
        console.log(`Actualizado: ${seed.email} (${seed.rol})`);
      } else {
        await users.insertOne({
          _id: seed._id,
          email: seed.email,
          passwordHash,
          nombre: seed.nombre,
          rol: seed.rol,
          activo: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`Creado: ${seed.email} (${seed.rol})`);
      }
    }

    console.log('\nSeed de usuarios operativos completado.');
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error('No se pudo ejecutar el seed:', error.message);
  process.exit(1);
});
