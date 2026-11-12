# ADR-003: Autenticación con JWT Stateless en Cookies HttpOnly y RBAC

* **Estado:** Aprobada
* **Fecha:** 2026-11-12
* **Decisores:** Equipo de Arquitectura & Antigravity Assistant

---

## Contexto y Planteamiento del Problema (P-002 / D-006)

El sistema soporta tres perfiles de usuario bien diferenciados:
1. **`cliente`:** Solo puede cotizar, crear envíos a su nombre y ver el historial de sus propios paquetes.
2. **`operador`:** Accede a la Torre de Control, asigna choferes/vehículos, registra incidencias y despacha envíos.
3. **`admin`:** Control total sobre usuarios, tarifas, configuración de sucursales y reportes ejecutivos.

El registro de clientes es público. Los operadores y administradores son precargados mediante seed o dados de alta por un admin.

Debemos definir el mecanismo de emisión, transporte y almacenamiento de credenciales de sesión en el navegador, protegiendo contra ataques XSS y CSRF.

---

## Opciones Consideradas

1. **Tokens JWT en LocalStorage del navegador:**
   * Fácil de implementar en React (Authorization Header: `Bearer <token>`).
   * **Vulnerable a XSS:** Si un atacante inyecta JavaScript, puede sustraer el token y suplantar al usuario.
2. **JWT en Cookies `HttpOnly`, `SameSite=Lax` y `Secure`:**
   * La cookie no puede ser leída ni manipulada por JavaScript del cliente (`HttpOnly`), mitigando ataques de robo de sesión por XSS.
   * `SameSite=Lax` protege contra ataques de falsificación de peticiones en sitios cruzados (CSRF).
   * La API de NestJS extrae automáticamente la cookie en cada solicitud mediante `cookie-parser` y `@nestjs/passport`.
3. **Sesiones con estado en servidor (Redis / Express-Session):**
   * Agrega dependencia de infraestructura (instancia de Redis) innecesaria para la escala de este proyecto de portfolio.

---

## Decisión

Implementar **JWT Stateless en Cookies `HttpOnly`** con **Control de Acceso Basado en Roles (RBAC)**:

* **Estructura del Usuario en MongoDB (`colección: usuarios`):**
  ```typescript
  {
    _id: "USR-001", // o uuid v4
    email: "lucia.ramirez@empresa.com",
    passwordHash: "$2b$12$...", // bcrypt 12 rounds
    nombre: "Lucía Ramírez",
    rol: "cliente" | "operador" | "admin",
    clienteId?: "CLI-001", // Si es cliente, vincula con la colección clientes del TP9
    activo: true,
    createdAt: Date,
    updatedAt: Date
  }
  ```
* **Estrategia de Tokens:**
  * **Access Token:** JWT firmado con clave secreta, expiración de **24 horas** (duración cómoda y segura para uso interactivo continuo sin complejidad excesiva de rotación asíncrona de refresh tokens en este MVP).
  * Cookie: `envioya_session`, banderas: `httpOnly: true`, `secure: process.env.NODE_ENV === 'production'`, `sameSite: 'lax'`, `path: '/'`.
* **Rutas protegidas en NestJS:**
  * Guard global o por controlador: `@UseGuards(JwtAuthGuard, RolesGuard)`.
  * Decorador declarativo de roles: `@Roles('operador', 'admin')`.
* **Endpoint de verificación rápida:**
  * `GET /api/auth/me`: Retorna los datos del usuario autenticado actual y su rol para hidratar el estado de la UI en React al recargar la página.

---

## Consecuencias

### Positivas
* **Máxima seguridad contra XSS:** Las credenciales nunca están accesibles al contexto de scripts del navegador.
* **Experiencia de usuario fluida:** El navegador envía la cookie en cada petición de forma nativa e invisible.
* **Integración nativa con la colección `clientes` del TP9:** Si el usuario tiene rol `cliente`, su `clienteId` se asocia automáticamente a los envíos que cree.

### Negativas / Mitigaciones
* *Configuración de CORS requerida:* Al estar frontend y backend en puertos distintos en desarrollo local (ej: `localhost:5173` y `localhost:3000`), NestJS debe habilitar CORS con `credentials: true` y origen explícito `http://localhost:5173`.
