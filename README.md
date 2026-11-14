# EnvíoYa App

Aplicación web de logística y paquetería construida sobre el diseño de base de datos MongoDB del TP9. Incluye un portal de clientes y un back-office operativo.

> **Estado:** PR #1 (monorepo + `@envioya/shared`), PR #2 (MongoDB + repositorios) y PR #3 (auth JWT + RBAC + login/registro) completos. El resto de las pantallas sigue en scaffold.
> **Stack decidido:** NestJS + React + MongoDB.
> **Base de datos:** `envioya` (TP9), reutilizada con el esquema existente + colecciones `usuarios` y `tarifas`.

---

## Qué incluye el producto

- **Público:** landing, tracking por código, registro y login.
- **Portal del cliente:** dashboard, cotizador/creación de envío en 3 pasos, mis envíos, detalle con tracking y mapa, perfil.
- **Back-office:** dashboard operativo, bandeja de envíos, asignación de repartidor/vehículo, transiciones de estado, clientes, repartidores, reportes y usuarios.
- **Integración externa:** Nominatim (geocodificación) + OSRM (ruteo) con caché y manejo de errores.
- **Seguridad:** JWT en cookie httpOnly, roles `cliente`/`operador`/`admin`, validaciones frontend y backend.
- **Calidad:** tests de dominio (cotización y máquina de estados), documentación y despliegue.

---

## Documentación

| Documento | Descripción |
|---|---|
| [`docs/product/PRD.md`](docs/product/PRD.md) | Product Requirements Document: alcance, roles, pantallas, requisitos, reglas de negocio. |
| [`docs/product/DESIGN.md`](docs/product/DESIGN.md) | Sistema de diseño: paleta, tipografía, componentes, tono. |
| [`docs/product/user-flows.md`](docs/product/user-flows.md) | Flujos de usuario con diagramas Mermaid. |
| [`docs/product/wireframes.html`](docs/product/wireframes.html) | Wireframes low-fi de 14 pantallas clave. Abrir en el navegador. |
| [`docs/product/stitch-prompt.md`](docs/product/stitch-prompt.md) | Prompts listos para Google Stitch: master prompt, design system y pantalla por pantalla. |
| [`docs/decisions/decision-log.md`](docs/decisions/decision-log.md) | Registro de decisiones y pendientes. |

---

## Cómo ver los wireframes

Abrir el archivo directamente en el navegador:

```text
docs/product/wireframes.html
```

No requiere servidor ni dependencias. Es un HTML autocontenido.

---

## Decisiones clave

- El proyecto **no modifica** los entregables del TP9; vive en `envioya-app/`.
- Se reutiliza el esquema del TP9 (`clientes`, `envios`, `eventos_seguimiento`, etc.) y se agregan `usuarios` y `tarifas`.
- Los envíos usan IDs string (`ENV-YYYY-####`) y códigos `EY-XXXXXX`.
- La baja de un envío es **lógica** (`cancelado`), nunca física.
- La sesión viaja en una cookie JWT `envioya_session` con `httpOnly`, `SameSite=Lax` y `secure` en producción (ADR-003).
- El registro público solo crea clientes. Operadores y administradores se cargan con el seed.
- La identidad visual se explora con Google Stitch a partir del PRD y `DESIGN.md`.

---

## Cómo ejecutar

Requisitos: Node.js 20+ y MongoDB 7.

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar MongoDB (ejemplo con dbpath local)
mongod --dbpath ..\.mongo-data

# 3. Configurar variables de entorno del backend
copy apps\backend\.env.example apps\backend\.env

# 4. Levantar backend y frontend en terminales separadas
npm run dev:backend
npm run dev:frontend

# 5. Cargar operadores y administradores de desarrollo
npm run db:seed

# 6. Verificar la base y correr los tests (con MongoDB activo)
npm run db:verify
npm test
```

- Backend: http://localhost:3000/api
- Health: http://localhost:3000/api/health
- Health + colecciones MongoDB: http://localhost:3000/api/health/db
- Frontend: http://localhost:5173

### Usuarios de desarrollo

El seed es idempotente y usa bcrypt con 12 rounds. Las contraseñas se pueden
cambiar con `SEED_ADMIN_PASSWORD` y `SEED_OPERADOR_PASSWORD` antes de ejecutarlo.

| Rol | Email | Contraseña por defecto | Redirección |
|---|---|---|---|
| `operador` | `operador@envioya.com` | `Operador1234!` | `/ops` |
| `admin` | `admin@envioya.com` | `Admin1234!` | `/ops` |

> Credenciales solo para desarrollo local. En producción, definí un
> `JWT_SECRET` propio y cambiá las contraseñas del seed.

---

## Autenticación y RBAC

| Método | Endpoint | Acceso | Descripción |
|---|---|---|---|
| `POST` | `/api/auth/register` | Público | Crea cliente + usuario, inicia sesión y setea la cookie. |
| `POST` | `/api/auth/login` | Público | Valida credenciales y setea la cookie (`recordarme` = 7 días). |
| `POST` | `/api/auth/logout` | Público | Limpia la cookie de sesión. |
| `GET` | `/api/auth/me` | Autenticado | Devuelve el usuario de la sesión actual. |

- Contraseñas con **bcrypt 12 rounds** y mensajes de login genéricos.
- Registro mínimo: nombre, email, teléfono y contraseña. La dirección se completa en el perfil.
- Guards `JwtAuthGuard` + `RolesGuard` con decorador `@Roles('cliente' | 'operador' | 'admin')`.
- Frontend: `AuthContext`, rutas protegidas y redirección por rol (`cliente` → `/app`, `operador`/`admin` → `/ops`).
- Si falla la creación del usuario, el registro compensa borrando el cliente creado.

**Tests:** 20 en total (8 de repositorios, 8 de auth y 4 unitarios de `RolesGuard`).

---

## Próximos pasos

1. PR #4: landing y tracking público con mapa.
2. PR #5 y #6: cotizador y portal del cliente.
3. PR #7 y #8: torre de control y reportes.

---

## Estructura del repositorio

```text
envioya-app/
├── apps/
│   ├── backend/      # NestJS + MongoDB driver
│   └── frontend/     # React 19 + Vite + Tailwind
├── packages/
│   └── shared/       # Tipos, enums y contratos compartidos
├── docs/
│   ├── product/      # PRD, diseño, flujos, wireframes, prompts
│   ├── architecture/ # Diagramas y ADRs
│   └── decisions/    # Decision log
└── README.md
```
