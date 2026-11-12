# ADR-002: Acceso a Datos con Driver Oficial de MongoDB y Patrón Repositorio Tipado

* **Estado:** Aprobada
* **Fecha:** 2026-11-12
* **Decisores:** Equipo de Arquitectura & Antigravity Assistant

---

## Contexto y Planteamiento del Problema (P-001)

La base de datos `envioya` fue diseñada e implementada en el TP9 con colecciones documentales avanzadas (`envios`, `clientes`, `repartidores`, `vehiculos`, `sucursales`, `tarifas`). Esta base cuenta con:
1. **JSON Schema Validators nativos de MongoDB** a nivel de motor (`$jsonSchema`).
2. **Identificadores de negocio en formato String** como `_id` principal (`"ENV-2026-0001"`, `"CLI-001"`, `"REP-001"`, `"SUC-CBA"`), prescindiendo del `ObjectId` por defecto de MongoDB.
3. Subdocumentos anidados polimórficos (`eventos`, `paquetes`, `direccion`).

Debemos definir la capa de persistencia en NestJS: ¿Utilizar **Mongoose ODM** o el **Driver oficial de MongoDB (`mongodb`)** con un patrón de repositorios fuertemente tipados?

---

## Opciones Consideradas

1. **Driver Oficial de MongoDB (`mongodb` Node.js driver) + Patrón Repositorio:**
   * Conexión directa a través de un `MongoClient` inyectado en un `MongoService` de NestJS.
   * Repositorios dedicados (`ShipmentsRepository`, `UsersRepository`, `BranchesRepository`) que operan directamente sobre `db.collection<IEnvioDocument>('envios')`.
   * Respeto total de las validaciones a nivel de motor ya configuradas en el script del TP9.
2. **Mongoose (`@nestjs/mongoose`):**
   * Requiere volver a declarar y sincronizar todos los esquemas en sintaxis Mongoose (`@Schema()`, `@Prop()`).
   * Por defecto, Mongoose asume que `_id` es un `ObjectId` de BSON y genera transformaciones automáticas que colisionan con los IDs string legibles del TP9.
   * Sobrecarga de validación duplicada: validar en Mongoose y luego en los validators de MongoDB.
3. **Prisma ORM con conector MongoDB:**
   * Requiere introspección compleja y soporte limitado para esquemas con subdocumentos libres y `$jsonSchema` preexistentes.

---

## Decisión

Utilizar el **Driver Oficial de MongoDB (`mongodb`)** encapsulado en un **Patrón Repositorio Tipado** dentro de NestJS:

* Se crea un módulo global `DatabaseModule` con un servicio `MongoDatabaseService` que administra el ciclo de vida del `MongoClient`.
* Cada repositorio (`ShipmentsRepository`, etc.) expone interfaces fuertemente tipadas en TypeScript utilizando los contratos de `@envioya/shared`.
* Se respetan al 100% las restricciones, índices y esquemas creados por el script `script/envioya_tp9.js`.
* Para la nueva colección `usuarios`, se creará su validator nativo o índice único por email en el backend al inicializar la aplicación.

---

## Consecuencias

### Positivas
* **Cero fricción con el modelo del TP9:** Ningún problema de casting o choque de tipos con los strings en `_id`.
* **Rendimiento superior y menor sobrecarga:** Sin capas intermedias de hidratación masiva de objetos propios de ORM/ODM.
* **Transparencia en consultas y pipelines de agregación:** Las agregaciones analíticas complejas del dashboard de operaciones (como métricas por sucursal o estado) se ejecutan de manera directa y limpia con la sintaxis nativa de MongoDB.

### Negativas / Mitigaciones
* *No hay hooks de ciclo de vida automáticos de Mongoose (pre-save, post-save):* Se manejan explícitamente en la capa de servicios de dominio de NestJS (`ShipmentsService`), lo cual es una buena práctica de diseño (lógica de negocio en servicios, no acoplada a la persistencia).
