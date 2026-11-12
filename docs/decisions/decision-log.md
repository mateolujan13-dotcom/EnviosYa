# Registro de decisiones — EnvíoYa App

> Documento vivo. Cada decisión relevante se registra acá con su justificación.
> Última actualización: 2026-11-12

| ID | Fecha | Decisión | Alternativas descartadas | Justificación | Estado |
|---|---|---|---|---|---|
| D-001 | 2026-11-12 | Producto: portal de clientes + back-office operativo. | Solo portal; solo back-office. | Cubre el flujo completo del negocio, habilita roles, CRUD principal, tracking y administración. Es el alcance más demostrativo para portfolio. | Aprobada |
| D-002 | 2026-11-12 | Contexto: proyecto de portfolio, sin fecha institucional. | TP con fecha cercana. | Permite priorizar calidad, documentación, tests y despliegue público sin recortar el flujo. | Aprobada |
| D-003 | 2026-11-12 | Stack: NestJS + React + MongoDB. | Next.js full-stack; Express + React. | NestJS hace visibles las capas, la inyección de dependencias y los patrones. React permite una UI propia y desacoplada. | Aprobada |
| D-004 | 2026-11-12 | Reutilizar el esquema MongoDB del TP9 tal cual y agregar la colección `usuarios`. | Migrar a ObjectId; crear base nueva. | Conserva el diseño documental, los validators, los IDs string y los patrones del TP9. La app se adapta al modelo, no al revés. | Aprobada |
| D-005 | 2026-11-12 | API externa: OpenStreetMap (Nominatim para geocodificación + OSRM para ruteo). | Google Maps; API de clima. | No requiere API key, es coherente con el dominio y permite mostrar mapas, distancias y tiempos reales. Se usará caché y manejo explícito de errores. | Aprobada |
| D-006 | 2026-11-12 | Auth: registro público de clientes; roles `cliente`, `operador`, `admin`; JWT en cookie httpOnly + RBAC. | Solo clientes; registro con aprobación; OAuth. | Cubre registro/login real, separación de permisos y un back-office protegido. La estrategia de refresh token queda pendiente de la etapa de arquitectura. | Aprobada |
| D-007 | 2026-11-12 | Ciclo de vida completo de Envíos con cancelación lógica y estado `cancelado`. | Baja física; gestión básica. | Mantiene trazabilidad y auditoría. El envío cancelado conserva historial y eventos. | Aprobada |
| D-008 | 2026-11-12 | Dirección visual generada en Google Stitch con Design System "Control Tower / Wayfinding". | Definir manualmente sin exploración. | Se generaron y sincronizaron localmente las 15 pantallas P0 en HTML y PNG consistentes. | Aprobada |
| D-009 | 2026-11-12 | Documentación desde el inicio: PRD, flujos, wireframes, design system, prompts, ADRs y decision log. | Documentar al final. | El proceso es parte del entregable y del portfolio. Permite revisar decisiones antes de implementar. | Aprobada |
| D-010 | 2026-11-12 | El proyecto vivirá en `envioya-app/` y los entregables del TP9 quedan intactos. | Mezclar app y TP9 en la misma raíz. | Separa el trabajo académico de la aplicación, evita ruido y facilita un repositorio limpio. | Aprobada |
| D-011 | 2026-11-12 | Monorepo con npm workspaces y paquete `@envioya/shared` (ADR-001). | Repositorios separados (multirepo). | Garantiza contratos y enums compartidos tipo-seguros de punta a punta. | Aprobada |
| D-012 | 2026-11-12 | Driver oficial de MongoDB (`mongodb`) + Patrón Repositorio en NestJS (ADR-002). | Mongoose ODM. | Respeta al 100% los IDs string y `$jsonSchema` nativos del TP9 sin fricción de casting. | Aprobada |
| D-013 | 2026-11-12 | Autenticación JWT Stateless en cookies `HttpOnly` y `SameSite=Lax` (ADR-003). | LocalStorage; sesiones en Redis. | Protección estándar de la industria contra ataques XSS sin dependencias de infraestructura extra. | Aprobada |
| D-014 | 2026-11-12 | Máquina de Estados Finita (FSM) estricta para transiciones de envío y bitácora de eventos inmutable (ADR-004). | Actualización libre de campos. | Garantiza integridad transaccional y coherencia en el flujo logístico. | Aprobada |
| D-015 | 2026-11-12 | Adaptador de ruteo OpenStreetMap con caché en memoria y fallback Haversine (ADR-005). | Google Maps pago; cálculo sin fallback. | Operatividad gratuita, sin claves privadas expuestas y alta disponibilidad. | Aprobada |

## Decisiones resueltas en Arquitectura

* **P-001 (Acceso a datos):** Resuelta en [ADR-002](file:///c:/Users/Itu/Downloads/tp9/envioya-app/docs/decisions/ADR-002-mongodb-data-access.md) optando por el driver oficial de MongoDB (`mongodb`) + patrón repositorio tipado.
* **P-002 (Refresh token / Sesiones):** Resuelta en [ADR-003](file:///c:/Users/Itu/Downloads/tp9/envioya-app/docs/decisions/ADR-003-auth-and-rbac.md) con JWT stateless de 24h almacenado en cookie `HttpOnly` y `SameSite=Lax`.

## Decisiones pendientes

| ID | Tema | Opciones | Próximo paso |
|---|---|---|---|
| P-003 | Deploy | Vercel + Render/Railway + MongoDB Atlas. | Validar cuentas y costos antes de implementar el deployment. |
| P-004 | Fórmula de cotización | Valores base, por km, por kg, frágil y seguro. | Parametrizar en la colección `tarifas` existente de MongoDB. |
| P-005 | Repositorio GitHub | Nombre, visibilidad y cuenta. | Crear el remoto cuando el usuario confirme. |
| P-006 | Alcance de reportes | Reportes P1 vs. solo dashboard operativo en MVP. | Confirmado en diseño (Pantalla 14 con gráficos y KPIs). |
