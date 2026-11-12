# PRD — EnvíoYa App

> **Versión:** 0.1 (borrador para revisión)
> **Fecha:** 2026-11-12
> **Producto:** EnvíoYa App — portal de clientes + back-office logístico
> **Base de datos:** `envioya` (TP9, MongoDB)
> **Stack decidido:** NestJS + React + MongoDB
> **Estado:** Diseño de producto. Todavía no hay implementación.

---

## 0. Cómo leer este documento

- **Decidido:** ya fue acordado con el usuario.
- **Propuesto:** recomendación de producto/diseño pendiente de aprobación.
- **Fuera de alcance:** no se implementa en el MVP.
- **P1/P2:** mejoras posteriores, no bloquean la primera versión.

### Decisiones tomadas

| Tema | Decisión |
|---|---|
| Producto | Portal de clientes + back-office operativo. |
| Contexto | Proyecto de portfolio, sin fecha institucional. |
| Stack | NestJS + React + MongoDB. |
| Base de datos | Reutilizar el esquema del TP9 y agregar `usuarios`. |
| API externa | Nominatim (geocodificación) + OSRM (ruteo). |
| Autenticación | Registro público de clientes; roles cliente/operador/admin; JWT httpOnly + RBAC. |
| Ciclo de envío | Cotizar → crear → editar pendiente → asignar → transicionar → entregar/cancelar con historial. |
| Baja | Cancelación lógica con estado `cancelado`; nunca se borra el documento. |
| Identidad visual | A generar con Google Stitch a partir de este PRD y el brief creativo. |

### Supuestos de trabajo

- UI en español (Argentina), moneda ARS y fechas DD/MM/YYYY.
- Desktop-first; el portal del cliente y el tracking público deben ser responsive.
- Los datos existentes del TP9 se conservan. Los nuevos clientes y envíos usan el mismo formato de IDs.
- La API externa se consume **solo desde el backend**; el frontend nunca llama a Nominatim/OSRM directamente.
- No hay pagos reales, notificaciones por email/SMS ni tracking en tiempo real en el MVP.
- El despliegue propuesto es Vercel (frontend) + Render/Railway (backend) + MongoDB Atlas (base de datos).

---

## 1. Resumen ejecutivo

EnvíoYa es una empresa de logística y paquetería que necesita convertir su operación en una experiencia digital clara para dos audiencias: **clientes** que quieren cotizar, enviar y seguir sus paquetes, y **operadores** que necesitan asignar recursos y mover envíos por sus estados sin perder trazabilidad.

La aplicación se construye sobre la base MongoDB diseñada en el TP9. El portal del cliente permite registrarse, cotizar un envío con distancia y tiempo reales, crearlo, editarlo mientras está pendiente, cancelarlo y seguir su recorrido. El back-office permite ver la cola operativa, asignar repartidor y vehículo, cambiar estados, registrar incidencias y consultar reportes. Un rol administrador gestiona usuarios y permisos.

El proyecto busca ser una pieza de portfolio: flujo completo, arquitectura por capas, patrones de diseño documentados, validaciones en frontend y backend, autenticación segura, tests y despliegue público.

---

## 2. Problema y oportunidad

### Problema

Hoy el negocio se gestiona con procesos manuales y datos dispersos. El cliente no tiene una forma simple de saber cuánto cuesta un envío, crearlo o seguirlo. El operador no tiene una vista única para priorizar pendientes, asignar recursos y detectar incidencias.

### Oportunidad

Una aplicación web bien diseñada puede:

- Reducir la fricción de cotizar y crear un envío.
- Dar certeza al cliente con costos claros, estados visibles y una línea de tiempo.
- Dar al operador una cola accionable y reglas de transición explícitas.
- Aprovechar el modelo documental del TP9 para consultar rápido el historial y los últimos eventos.

### Propuesta de valor

> **“Tu envío, en el mapa. Sin sorpresas.”**
>
> Cotizá antes de confirmar, seguí cada movimiento y resolvé todo desde un solo lugar.

---

## 3. Objetivos y métricas

### Objetivos de producto

1. Permitir que un cliente complete el flujo **registro → cotización → creación → seguimiento** sin asistencia.
2. Permitir que un operador complete el flujo **pendiente → asignación → despacho → entrega** con trazabilidad.
3. Ofrecer un back-office con permisos por rol y reportes operativos básicos.
4. Integrar una API externa real con manejo de errores, caché y degradación graceful.

### Métricas de éxito (portfolio)

| Métrica | Objetivo |
|---|---|
| Flujo crítico de creación de envío | Completable de punta a punta sin errores. |
| Cobertura de tests del dominio | Servicio de cotización y máquina de estados con tests unitarios. |
| Validaciones | 100% de los formularios con validación frontend y backend. |
| Accesibilidad | Navegación por teclado y contraste WCAG AA en las vistas principales. |
| Despliegue | Frontend, backend y base de datos accesibles públicamente. |
| Documentación | PRD, flujos, wireframes, arquitectura, ADRs y guía de usuario. |

---

## 4. Usuarios y roles

| Rol | Quién es | Puede hacer | No puede hacer |
|---|---|---|---|
| **Visitante** | Persona sin sesión. | Ver landing, seguir un envío por código, registrarse, iniciar sesión. | Crear envíos, ver datos privados, acceder al back-office. |
| **Cliente** | Particular o contacto de una empresa con cuenta. | Ver su dashboard, cotizar, crear envíos, editar/cancelar pendientes, seguir sus envíos, editar su perfil. | Ver envíos de otros, asignar repartidores, cambiar estados operativos, gestionar usuarios. |
| **Operador** | Empleado de sucursal/operaciones. | Ver la cola completa, asignar repartidor/vehículo, cambiar estados, registrar incidencias, cancelar con motivo, consultar clientes y reportes. | Gestionar usuarios/roles, modificar tarifas, editar datos sensibles de facturación. |
| **Admin** | Responsable del sistema. | Todo lo del operador + gestionar usuarios, roles, activación/desactivación y configuración básica. | Eliminar su propia cuenta o degradar al último admin. |

### Necesidades por rol

- **Visitante:** “¿Dónde está mi paquete?” sin crear cuenta.
- **Cliente:** “Quiero saber cuánto sale y cuándo llega antes de confirmar”.
- **Operador:** “¿Qué tengo que resolver ahora y con qué recursos?”.
- **Admin:** “¿Quién puede entrar y qué rol tiene?”.

---

## 5. Alcance

### 5.1 MVP (Must have)

**Público**

- Landing con propuesta de valor y buscador de tracking.
- Tracking público por código, con estado, timeline y mapa.
- Registro de clientes con validaciones.
- Login/logout con sesión segura.
- Recuperación de contraseña: **P2**, no MVP.

**Portal del cliente**

- Dashboard con resumen y accesos rápidos.
- Cotizador/creación de envío en 3 pasos: origen/destino, paquetes, cotización/confirmación.
- Listado de envíos con filtros y búsqueda.
- Detalle de envío con timeline, mapa, paquetes, costo y repartidor.
- Edición de envío pendiente.
- Cancelación lógica de envío pendiente.
- Perfil básico: datos personales y dirección principal.

**Back-office**

- Dashboard operativo con KPIs y cola prioritaria.
- Bandeja de envíos con filtros por estado, sucursal, fecha y búsqueda.
- Detalle operativo con asignación de repartidor/vehículo y transiciones de estado.
- Registro de incidencias y cancelación con motivo.
- Listado de clientes y detalle.
- Listado de repartidores y vehículos.
- Reportes operativos básicos (P1, recomendado).
- Gestión de usuarios y roles (solo admin).

**Transversal**

- Validación frontend y backend.
- Manejo de errores de API externa con reintento y fallback.
- Estados de carga, vacío, error y éxito.
- Responsive en portal del cliente y tracking.
- Accesibilidad AA en vistas principales.
- Documentación y despliegue.

### 5.2 Fuera de alcance (MVP)

- Pagos reales, pasarela de pago y conciliación.
- Facturación electrónica; las facturas del TP9 quedan como dato de lectura/simulado.
- Notificaciones por email, SMS o push.
- Tracking en tiempo real por WebSocket/SSE; se actualiza por polling o acción del usuario.
- App móvil nativa.
- Optimización de rutas o GPS en vivo.
- Firma digital, fotos de entrega o adjuntos.
- Multiempresa/multi-tenant.
- Envíos internacionales.
- Chat con el cliente.

### 5.3 Roadmap posterior

**P1**

- Reportes con exportación CSV.
- Recuperación de contraseña.
- Notificaciones por email al cambiar el estado.
- Historial de auditoría visible para admin.
- Configuración de tarifas desde el back-office.

**P2**

- Tracking en tiempo real.
- Pagos.
- Fotos de entrega.
- App móvil.
- Integración con facturación.

---

## 6. Principios de producto y UX

1. **El estado siempre es visible.** Cada pantalla del envío muestra dónde está, qué sigue y cuándo llega.
2. **Cotizá antes de confirmar.** El cliente ve distancia, tiempo y desglose de costo antes de crear el envío.
3. **La operación no adivina.** El back-office muestra solo las acciones válidas para el estado actual.
4. **Los datos que se usan juntos se ven juntos.** Mapa, timeline y resumen comparten pantalla.
5. **Los errores son recuperables.** Mensajes claros, causa, acción sugerida y reintento.
6. **Menos ruido, más señal.** Sin métricas decorativas; cada tarjeta responde a una decisión.
7. **Consistencia antes que sorpresa.** Los mismos componentes y vocabulario en todo el producto.

---

## 7. Flujos principales

Los diagramas completos están en [`user-flows.md`](./user-flows.md).

| Flujo | Actor | Resultado |
|---|---|---|
| Tracking público | Visitante | Ve estado, timeline y mapa sin iniciar sesión. |
| Registro/login | Visitante | Obtiene una sesión con rol y accede a su portal. |
| Cotización y creación | Cliente | Obtiene un precio y crea un envío pendiente. |
| Gestión del cliente | Cliente | Edita o cancela un envío pendiente. |
| Asignación y transición | Operador | Asigna recursos, despacha y mueve el envío hasta la entrega. |
| Administración | Admin | Gestiona usuarios, roles y estado de cuentas. |

---

## 8. Arquitectura de información

```text
Público
├── /                         Landing
├── /seguimiento              Tracking público (buscador)
├── /seguimiento/:codigo      Resultado de tracking
├── /login                    Iniciar sesión
└── /registro                 Crear cuenta

Portal del cliente (/app)
├── /app                      Dashboard
├── /app/envios               Mis envíos
├── /app/envios/nuevo         Nuevo envío (wizard)
├── /app/envios/:id           Detalle del envío
└── /app/perfil               Perfil

Back-office (/ops)
├── /ops                      Dashboard operativo
├── /ops/envios               Bandeja de envíos
├── /ops/envios/:id           Detalle y asignación
├── /ops/clientes             Clientes
├── /ops/clientes/:id         Detalle de cliente
├── /ops/repartidores         Repartidores y vehículos
├── /ops/reportes             Reportes
└── /ops/usuarios             Usuarios (solo admin)
```

### Navegación

- **Público:** top navigation con logo, Servicios, Seguimiento, Empresas, “Ingresar” y CTA “Cotizar envío”.
- **Cliente:** sidebar clara con Inicio, Mis envíos, Nuevo envío, Perfil; top bar con búsqueda de tracking, notificaciones y avatar.
- **Ops:** sidebar oscura con Dashboard, Envíos, Clientes, Repartidores, Reportes, Usuarios; top bar con sucursal activa, búsqueda y avatar.
- **Móvil:** sidebar colapsable; tablas se convierten en tarjetas; acciones principales fijas al pie cuando corresponde.

---

## 9. Inventario de pantallas

### Prioridades

- **P0:** imprescindible para el MVP y para los mockups iniciales.
- **P1:** recomendado para una primera versión completa.
- **P2:** posterior.

| ID | Pantalla | Ruta | Rol | Prioridad |
|---|---|---|---|---|
| P-01 | Landing | `/` | Visitante | P0 |
| P-02 | Tracking público | `/seguimiento/:codigo` | Visitante | P0 |
| P-03 | Login | `/login` | Visitante | P0 |
| P-04 | Registro | `/registro` | Visitante | P0 |
| C-01 | Dashboard cliente | `/app` | Cliente | P0 |
| C-02 | Nuevo envío — origen/destino | `/app/envios/nuevo` | Cliente | P0 |
| C-03 | Nuevo envío — paquetes | `/app/envios/nuevo` | Cliente | P0 |
| C-04 | Nuevo envío — cotización | `/app/envios/nuevo` | Cliente | P0 |
| C-05 | Mis envíos | `/app/envios` | Cliente | P0 |
| C-06 | Detalle de envío | `/app/envios/:id` | Cliente | P0 |
| C-07 | Perfil | `/app/perfil` | Cliente | P1 |
| O-01 | Dashboard operativo | `/ops` | Operador/Admin | P0 |
| O-02 | Bandeja de envíos | `/ops/envios` | Operador/Admin | P0 |
| O-03 | Detalle y asignación | `/ops/envios/:id` | Operador/Admin | P0 |
| O-04 | Clientes | `/ops/clientes` | Operador/Admin | P1 |
| O-05 | Repartidores y vehículos | `/ops/repartidores` | Operador/Admin | P1 |
| O-06 | Reportes | `/ops/reportes` | Operador/Admin | P1 |
| A-01 | Usuarios | `/ops/usuarios` | Admin | P1 |
| O-07 | Sucursales | `/ops/sucursales` | Operador/Admin | P2 |
| A-02 | Configuración de tarifas | `/ops/configuracion` | Admin | P2 |

---

## 9.1 Especificación de pantallas P0

### P-01 · Landing

- **Objetivo:** explicar la propuesta de valor, habilitar tracking rápido y llevar al registro/cotización.
- **Layout:** top nav; hero en dos columnas (copy + mapa con ruta); buscador de tracking; franja de métricas; tres tarjetas de servicio; “Cómo funciona” en 3 pasos; CTA final; footer.
- **Contenido:**
  - H1: “Tu envío, en el mapa. Sin sorpresas.”
  - Sub: “Cotizá, despachá y seguí cada paquete desde un solo lugar.”
  - Input: “Ingresá tu código EY-XXXXXX”.
  - CTAs: “Cotizar envío” (primario), “Seguir envío” (secundario).
  - Métricas: “+12.000 envíos”, “98% a tiempo”, “Cobertura nacional”.
- **Acciones:** buscar tracking; ir a registro; ir a login; ver secciones.
- **Estados:** default; código inválido; código no encontrado; carga.
- **Notas para Stitch:** el mapa y la línea de ruta son el héroe visual; evitar fotos de stock y clichés de logística.

### P-02 · Tracking público

- **Objetivo:** dar certeza sobre el estado y la ubicación del envío sin login.
- **Layout:** nav compacta; buscador; cabecera de estado (código, chip, ETA); dos columnas: timeline de eventos + mapa/resumen; ayuda al pie.
- **Contenido:** código, estado, ETA, origen/destino, cantidad de paquetes, nombre del repartidor, últimos 5 eventos, mapa con última ubicación.
- **Acciones:** copiar código; buscar otro envío; iniciar sesión para ver más; contacto/soporte.
- **Estados:** sin código; cargando; no encontrado; error de red; éxito.
- **Notas:** la timeline es el elemento principal; en móvil el mapa va debajo.

### P-03 · Login

- **Objetivo:** permitir el acceso seguro y redirigir según rol.
- **Layout:** split screen 45/55; formulario a la izquierda; panel de marca con mapa/ruta y propuesta de valor a la derecha.
- **Contenido:** email, contraseña, “Recordarme”, “Olvidé mi contraseña” (P2), CTA “Ingresar”, link “Crear cuenta”.
- **Acciones:** login; ir a registro; mostrar/ocultar contraseña.
- **Estados:** validación; credenciales inválidas; bloqueo por rate limit; carga; éxito.
- **Notas:** no revelar si el email existe; mensaje genérico “Email o contraseña incorrectos”.

### P-04 · Registro

- **Objetivo:** crear una cuenta de cliente con datos mínimos y validados.
- **Layout:** mismo split screen; formulario más largo, con ayudas claras.
- **Contenido:** nombre y apellido, email, teléfono, contraseña, confirmar contraseña, aceptación de términos, CTA “Crear cuenta”, link “Ya tengo cuenta”.
- **Acciones:** registrar; ver términos; volver a login.
- **Estados:** validación por campo; email ya registrado; contraseña débil; carga; éxito con login automático.
- **Notas:** mostrar requisitos de contraseña antes de enviar; no pedir dirección en el registro (se completa en el perfil o en el primer envío).

### C-01 · Dashboard cliente

- **Objetivo:** responder “¿qué está pasando con mis envíos y qué puedo hacer ahora?”.
- **Layout:** app shell; saludo; dos acciones rápidas; tres KPI cards; tabla de envíos recientes; tarjeta de mapa con el envío activo más relevante.
- **Contenido:** “Hola, Lucía”; “Cotizá un envío”; “Seguí un envío”; KPIs: activos, entregados este mes, gasto del mes; últimos envíos con código, destino, estado, ETA y total.
- **Acciones:** nuevo envío; ver todos; abrir detalle; repetir envío (P1).
- **Estados:** sin envíos (empty state con CTA); carga; error; éxito.
- **Notas:** no convertir esto en un dashboard genérico de analytics; la acción principal es cotizar.

### C-02 · Nuevo envío — Paso 1: origen y destino

- **Objetivo:** capturar direcciones válidas y calcular la ruta.
- **Layout:** stepper visible; columna principal con tarjeta de origen (precargada) y formulario de destino; columna derecha con mapa y resumen de ruta; CTA “Calcular ruta”.
- **Contenido:** origen (nombre, dirección, teléfono), destino (nombre, dirección, ciudad, provincia, CP, teléfono), notas.
- **Acciones:** editar origen; completar destino; calcular ruta; volver.
- **Estados:** validación; geocodificación en curso; dirección no encontrada; ruta no disponible; ruta calculada.
- **Notas:** mostrar el mapa a medida que se completa la dirección; no bloquear si la geocodificación falla: permitir continuar con advertencia y distancia estimada.

### C-03 · Nuevo envío — Paso 2: paquetes

- **Objetivo:** capturar paquetes y calcular peso/volumen.
- **Layout:** stepper; lista de tarjetas de paquete; botón “Agregar paquete”; sidebar con resumen (cantidad, peso total, fragile count) y CTA “Continuar”.
- **Contenido:** descripción, peso (kg), alto/ancho/profundo (cm), frágil (toggle), valor declarado, características adicionales.
- **Acciones:** agregar/eliminar paquete; editar; continuar; volver.
- **Estados:** validación; peso/dimensiones inválidas; límite de paquetes; carga.
- **Notas:** mostrar el impacto del peso y la fragilidad en el costo estimado.

### C-04 · Nuevo envío — Paso 3: cotización y confirmación

- **Objetivo:** mostrar el costo final y crear el envío con confianza.
- **Layout:** stepper; resumen de ruta (mapa, distancia, tiempo); desglose de costo; toggle de seguro; total destacado; CTA “Confirmar envío”; nota de validez.
- **Contenido:** flete base, distancia, peso, recargo por fragilidad, seguro, total; “Cotización válida por 30 minutos”; dirección de origen/destino; paquetes.
- **Acciones:** confirmar; volver a editar; contratar seguro; cancelar.
- **Estados:** cotización vencida; error de API; carga; éxito con redirección al detalle.
- **Notas:** el total debe ser el elemento más visible; explicar cada línea del costo.

### C-05 · Mis envíos

- **Objetivo:** encontrar y gestionar envíos propios.
- **Layout:** header con CTA “Nuevo envío”; barra de búsqueda; filtros por estado y fecha; tabla en desktop, tarjetas en móvil; paginación.
- **Contenido:** código, destino, estado, fecha de creación, ETA, total, acciones.
- **Acciones:** buscar; filtrar; abrir detalle; crear envío; limpiar filtros.
- **Estados:** vacío; sin resultados; carga; error.
- **Notas:** recordar filtros en la URL para que sean compartibles.

### C-06 · Detalle de envío

- **Objetivo:** entender el estado y el historial, y actuar si corresponde.
- **Layout:** back link; cabecera con código, chip de estado y ETA; acciones contextuales; dos columnas: timeline + mapa; debajo: paquetes, costo, direcciones, repartidor.
- **Contenido:** todos los datos del envío; últimos eventos; mapa; comprobante/código; contacto de soporte.
- **Acciones:** editar (solo pendiente y sin asignar); cancelar (solo pendiente); copiar código; volver.
- **Estados:** carga; no encontrado; sin permiso; cancelación confirmada; error.
- **Notas:** si no se puede editar/cancelar, explicar por qué y ofrecer contacto.

### O-01 · Dashboard operativo

- **Objetivo:** mostrar qué necesita atención ahora.
- **Layout:** app shell oscura; filtros de fecha/sucursal; cuatro KPI cards (pendientes, en tránsito, incidencias, entregados hoy); cola prioritaria; mapa de rutas activas; panel de alertas.
- **Contenido:** KPIs, tabla de pendientes con acción “Asignar”, incidencias recientes, repartidores disponibles.
- **Acciones:** abrir envío; asignar; filtrar; ver bandeja completa.
- **Estados:** carga; sin pendientes; error; actualización manual.
- **Notas:** la densidad es bienvenida; priorizar la acción siguiente.

### O-02 · Bandeja de envíos

- **Objetivo:** encontrar y operar cualquier envío.
- **Layout:** header con búsqueda; tabs por estado con contadores; filtros de sucursal/fecha; tabla; paginación.
- **Contenido:** código, cliente, destino, estado, repartidor, fecha, total, acciones.
- **Acciones:** filtrar; buscar; abrir detalle; asignar; cambiar estado.
- **Estados:** vacío; sin resultados; carga; error.
- **Notas:** tabs con conteo; columnas configurables (P2).

### O-03 · Detalle y asignación

- **Objetivo:** resolver el envío: asignar recursos, mover estado, registrar incidencia.
- **Layout:** cabecera con código/estado/cliente; columna principal con timeline, paquetes y direcciones; sidebar con tarjeta de asignación (repartidor, vehículo, sucursal), botones de transición y notas internas; mapa debajo.
- **Contenido:** datos completos; disponibilidad de repartidores; capacidad del vehículo; historial; motivo de incidencia.
- **Acciones:** asignar; desasignar; despachar; marcar en sucursal/en reparto/entregado; registrar incidencia; cancelar con motivo.
- **Estados:** sin repartidores disponibles; capacidad insuficiente; transición inválida; confirmación; éxito.
- **Notas:** mostrar solo transiciones válidas; las acciones destructivas piden confirmación y motivo.

---

## 10. Requisitos funcionales

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-01 | Registro de cliente con nombre, email, teléfono y contraseña. | Must | Email único; contraseña fuerte; se crea usuario y cliente; login automático. |
| RF-02 | Login con email/contraseña. | Must | Credenciales válidas → cookies httpOnly; inválidas → error genérico. |
| RF-03 | Logout y revocación de sesión. | Must | Cookies eliminadas; sesión invalidada. |
| RF-04 | RBAC por rol. | Must | Cliente solo ve sus envíos; operador ve todos; admin gestiona usuarios. |
| RF-05 | Tracking público por código. | Must | Código válido → estado, timeline y mapa; inexistente → empty state. |
| RF-06 | Dashboard del cliente con resumen. | Must | Muestra activos, entregados del mes, gasto y envíos recientes. |
| RF-07 | Cotización con API externa. | Must | Direcciones geocodificadas; distancia/tiempo; desglose de costo; errores controlados. |
| RF-08 | Creación de envío. | Must | Genera ID y código únicos; estado `pendiente`; evento inicial; valida datos. |
| RF-09 | Listado de envíos del cliente. | Must | Filtros por estado/fecha, búsqueda y paginación. |
| RF-10 | Detalle de envío. | Must | Muestra datos, timeline, mapa, paquetes, costo. |
| RF-11 | Edición de envío pendiente. | Must | Solo si `estado = pendiente` y sin repartidor asignado; recalcula cotización. |
| RF-12 | Cancelación lógica. | Must | Cambia a `cancelado`; conserva documento; registra evento y motivo. |
| RF-13 | Asignación de repartidor/vehículo. | Must | Solo recursos disponibles; capacidad suficiente; actualiza resumen. |
| RF-14 | Transiciones de estado. | Must | Solo transiciones permitidas; cada una crea evento de tracking. |
| RF-15 | Registro de incidencia. | Must | Estado `con_incidencia`; motivo obligatorio; evento. |
| RF-16 | Historial de tracking. | Must | Bucket diario en `eventos_seguimiento`; últimos 5 en `envios.ultimosEventos`. |
| RF-17 | Dashboard operativo. | Must | KPIs y cola prioritaria con acción de asignación. |
| RF-18 | Bandeja de envíos. | Must | Filtros por estado, sucursal, fecha; búsqueda; paginación. |
| RF-19 | Gestión de clientes (ops). | Should | Listado, búsqueda y detalle; sin editar datos sensibles. |
| RF-20 | Repartidores y vehículos (ops). | Should | Listado, disponibilidad y asignación actual. |
| RF-21 | Reportes operativos. | Should | Envíos por sucursal, tiempo promedio, top repartidores, distribución por estado. |
| RF-22 | Gestión de usuarios (admin). | Should | Listar, cambiar rol, activar/desactivar; no autodegradarse. |
| RF-23 | Perfil del cliente. | Should | Editar nombre, teléfono y dirección; email solo lectura o verificación. |
| RF-24 | Validación frontend. | Must | Todos los formularios con reglas, mensajes por campo y bloqueo de envío inválido. |
| RF-25 | Validación backend. | Must | DTOs/Zod; 400 con detalle; 401/403; 404; 409; 422; 503 externo. |
| RF-26 | Manejo de errores externos. | Must | Timeout, reintento, caché y mensaje accionable; nunca falla silenciosamente. |
| RF-27 | Estados de UI. | Must | Loading, empty, error, success en todas las pantallas de datos. |
| RF-28 | Responsive. | Must | Portal cliente y tracking usables desde 360px; ops desde 1024px. |
| RF-29 | Accesibilidad. | Must | Labels, foco visible, teclado, contraste AA, `aria-live` para errores. |
| RF-30 | Seguridad. | Must | Hash de contraseña, cookies httpOnly, CORS, rate limit, Helmet, sanitización. |
| RF-31 | Tests de dominio. | Should | PricingService y StateMachine con tests unitarios (TDD documentado). |
| RF-32 | Documentación de API. | Should | Swagger/OpenAPI disponible en `/api/docs`. |
| RF-33 | Seed de demo. | Should | Usuarios demo (cliente, operador, admin) y datos coherentes con TP9. |
| RF-34 | Despliegue. | Must | Frontend, API y DB accesibles; variables de entorno documentadas. |
| RF-35 | Guía de usuario. | Must | Pasos para registrarse, cotizar, crear, seguir y operar. |

---

## 11. Reglas de negocio

### 11.1 Máquina de estados del envío

Estados del TP9 + `cancelado` (extensión necesaria para la baja lógica).

| Estado | Significado | Transiciones permitidas |
|---|---|---|
| `pendiente` | Creado, sin despachar. | `en_transito`, `cancelado` |
| `en_transito` | En camino entre sucursales o hacia destino. | `en_sucursal`, `con_incidencia`, `devuelto` |
| `en_sucursal` | Recibido en una sucursal. | `en_reparto`, `en_transito`, `con_incidencia` |
| `en_reparto` | En poder del repartidor, última milla. | `entregado`, `con_incidencia`, `devuelto` |
| `entregado` | Entregado al destinatario. | — (final) |
| `con_incidencia` | Problema que requiere resolución. | `en_transito`, `en_sucursal`, `en_reparto`, `devuelto`, `cancelado` |
| `devuelto` | Devuelto al remitente. | — (final) |
| `cancelado` | Cancelado lógicamente. | — (final) |

**Reglas adicionales**

- El cliente solo puede cancelar si el envío está `pendiente` y no tiene repartidor asignado.
- El operador puede cancelar `pendiente` o `con_incidencia`, siempre con motivo.
- `entregado`, `devuelto` y `cancelado` son finales; no se editan.
- Cada transición genera un evento de tracking con timestamp, actor, estado anterior/nuevo y observación.
- Una transición inválida devuelve `409 Conflict` con el código `INVALID_STATE_TRANSITION`.

### 11.2 Asignación de recursos

- Solo se asigna a envíos `pendiente`.
- El repartidor debe estar `disponible` y pertenecer a la sucursal de origen (o a la sucursal actual, si aplica).
- El vehículo debe estar `operativo` y tener capacidad `capacidadKg >= pesoTotalKg`.
- Al asignar se guarda `repartidorId`, `repartidorResumen` (nombre, teléfono) y `vehiculoId`.
- Asignar no cambia el estado; el despacho es una acción separada (`pendiente → en_transito`).
- Desasignar solo se permite si el envío sigue `pendiente`.

### 11.3 Cotización (propuesta inicial a validar)

```text
fleteBase       = ARS 3.500
recargoKm       = ARS 180 / km
recargoPeso     = ARS 250 / kg
recargoFragil   = ARS 800 por paquete frágil
seguro          = 2% del valor declarado (opcional)
subtotal        = fleteBase + (km * recargoKm) + (kg * recargoPeso) + fragiles
total           = max(subtotal + seguro, ARS 5.000)
redondeo        = al siguiente múltiplo de 100
```

- La cotización se calcula en el backend; el frontend solo muestra el desglose.
- La cotización tiene una validez de 30 minutos.
- Si la API externa falla, se puede usar una distancia estimada (Haversine × 1.3) con advertencia visible; el usuario debe aceptarla.
- Los valores deben vivir en una política de precios configurable (Strategy), no hardcodeados en el controlador.

### 11.4 Tracking

- `envios.ultimosEventos` guarda como máximo 5 eventos.
- `envios.totalEventos` se incrementa con cada evento.
- `eventos_seguimiento` agrupa por envío y día (`_id = EVB-{envioId}-{YYYY-MM-DD}`), con `$push` y `$inc`.
- El tracking público solo muestra los últimos eventos y datos no sensibles del repartidor.
- Los eventos internos incluyen actor, motivo y datos completos para auditoría.

### 11.5 Identificadores

- `clientes._id`: `CLI-####` (secuencia).
- `envios._id`: `ENV-YYYY-####` (secuencia por año).
- `codigo`: `EY-` + 6 caracteres alfanuméricos en mayúsculas, único.
- `usuarios._id`: ObjectId.
- Los IDs se generan en el backend con una colección de contadores (`contadores`) y se inicializan a partir de los datos existentes del TP9.

### 11.6 Reglas de datos

- No se borra físicamente un envío ni un cliente con historial; se desactiva o cancela.
- Un cliente puede tener `activo: false` y conservar sus envíos.
- El email de un usuario es único (case-insensitive).
- El `clienteId` de un usuario cliente es obligatorio; operadores/admin lo tienen en `null`.
- Los datos de facturación del TP9 no se editan desde el MVP.

---

## 12. Integración externa

### 12.1 Nominatim (geocodificación)

- Endpoint backend: `GET https://nominatim.openstreetmap.org/search`.
- Parámetros: `format=jsonv2`, `q`, `countrycodes=ar`, `limit=1`, `addressdetails=1`.
- Requiere `User-Agent` identificable y respetar el uso justo (máx. ~1 req/s).
- Se cachea por hash de dirección normalizada durante 30 días.
- Si no encuentra la dirección: error `ADDRESS_NOT_FOUND` con sugerencia de corregir.

### 12.2 OSRM (ruteo)

- Endpoint backend: `GET https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}`.
- Parámetros: `overview=full`, `geometries=geojson`, `steps=false`.
- Devuelve distancia (m), duración (s) y geometría de la ruta.
- Se cachea por par origen/destino durante 7 días.
- Si falla: `EXTERNAL_ROUTE_UNAVAILABLE`; se ofrece distancia estimada con advertencia.

### 12.3 Manejo de errores

| Situación | Código | Respuesta UI |
|---|---|---|
| Timeout (5s) | `EXTERNAL_TIMEOUT` | “La consulta tardó demasiado. Reintentá.” |
| Sin resultados | `ADDRESS_NOT_FOUND` | “No encontramos esa dirección. Revisá calle/número/ciudad.” |
| Error de proveedor | `EXTERNAL_API_ERROR` | “El servicio de mapas no está disponible. Reintentá en unos minutos.” |
| Rate limit | `EXTERNAL_RATE_LIMITED` | “Demasiadas consultas. Esperá unos segundos.” |
| Fallback aceptado | `ESTIMATED_DISTANCE` | “Usamos una distancia estimada. El costo puede variar.” |

- Reintento automático: 1 vez con backoff de 500 ms para errores 5xx/timeout.
- Nunca se muestra el error crudo del proveedor al usuario.
- Se registra `requestId`, latencia y código de error en logs.

### 12.4 Mapa en el frontend

- MapLibre GL JS o Leaflet con tiles de OpenStreetMap.
- Estilo desaturado, ruta en naranja, marcadores en tinta.
- Para producción con tráfico real, usar un proveedor de tiles con SLA (MapTiler/Stadia) y clave restringida. El demo puede usar tiles estándar de OSM con atribución.

---

## 13. Sistema de diseño (resumen para Stitch)

El detalle está en [`DESIGN.md`](./DESIGN.md) y los prompts en [`stitch-prompt.md`](./stitch-prompt.md).

### Concepto

**“Control Tower / Wayfinding”**: la ruta como sistema. La UI toma prestado el lenguaje de los mapas de transporte, la señalética y las etiquetas de paquetería. Preciso, humano y optimista; no es un SaaS corporativo genérico.

### Paleta

| Token | Hex | Uso |
|---|---|---|
| `ink-950` | `#08111F` | Fondo de sidebar ops, texto principal. |
| `ink-900` | `#0B1220` | Superficies oscuras, títulos. |
| `paper` | `#F6F2E9` | Fondo público y de cliente. |
| `surface` | `#FFFFFF` | Tarjetas y tablas. |
| `sand-300` | `#D8D0C0` | Bordes y divisores. |
| `signal-600` | `#D93A00` | CTA primario, ruta activa. |
| `signal-500` | `#FF5A1F` | Acentos y alertas. |
| `route-600` | `#1D4ED8` | Links, estados en tránsito. |
| `mint-300` | `#B9F27C` | Éxito, entregado. |
| `danger-600` | `#B42318` | Errores e incidencias. |

### Tipografía

- **Display:** Archivo 600/700, tracking negativo.
- **Body:** Inter 400/500/600.
- **Mono:** IBM Plex Mono 400/500 para códigos, IDs y timestamps.

### Layout y componentes

- Grid de 12 columnas, max-width 1440, gutters de 24px.
- Sidebar ops de 248px en tinta; sidebar cliente clara.
- Cards con borde de 1px, radio 8px, sin sombras pesadas.
- Chips de estado con punto + label.
- Timeline vertical con línea sólida para completado, punteada para futuro y nodo naranja para el estado actual.
- Stepper numerado con líneas de conexión.
- Tablas densas, header sticky, filas de 44px.
- Mapas con ruta naranja y marcadores de tinta.
- Empty states con ilustración de línea de ruta, no con personajes 3D.

### Tono

Directo, preciso y útil. Español rioplatense. Sin jerga innecesaria en cliente; vocabulario operativo en back-office. Ejemplos:

- “Tu envío está en camino.”
- “Llega mañana antes de las 18.”
- “No pudimos calcular la ruta. Reintentá o usá una distancia estimada.”
- “Todavía no tenés envíos. Cotizá el primero en menos de 2 minutos.”

---

## 14. Contenido y microcopy

### Landing

- H1: “Tu envío, en el mapa. Sin sorpresas.”
- Sub: “Cotizá, despachá y seguí cada paquete desde un solo lugar.”
- CTA: “Cotizar envío”.
- Tracking: “Ingresá tu código EY-XXXXXX”.

### Wizard

- Paso 1: “¿De dónde a dónde?”
- Paso 2: “¿Qué viaja?”
- Paso 3: “Todo listo para confirmar”.
- Error de dirección: “No encontramos esa dirección. Revisá calle, número y ciudad.”
- Error de ruta: “No pudimos calcular la ruta. Reintentá o continuá con una distancia estimada.”

### Tracking

- Pendiente: “Estamos preparando tu envío.”
- En tránsito: “Tu envío está en camino.”
- En sucursal: “Llegó a la sucursal de {ciudad}.”
- En reparto: “Está en manos de {repartidor}.”
- Entregado: “Entregado. ¡Listo!”
- Incidencia: “Hay una incidencia con tu envío. Te vamos a contactar.”
- Cancelado: “Este envío fue cancelado.”

### Empty states

- Mis envíos: “Todavía no tenés envíos. Cotizá el primero y seguilo desde acá.”
- Bandeja ops: “No hay envíos con estos filtros. Probá ampliar el rango de fechas.”
- Reportes: “No hay datos para el período seleccionado.”

---

## 15. Estados de UI

| Pantalla | Loading | Empty | Error | Success |
|---|---|---|---|---|
| Tracking | Skeleton de cabecera + timeline | Código no encontrado | No pudimos consultar el envío | Timeline + mapa |
| Login | Botón con spinner | — | Credenciales inválidas / rate limit | Redirect según rol |
| Registro | Botón con spinner | — | Errores por campo / email duplicado | Login automático |
| Dashboard cliente | Skeleton de KPIs y tabla | Sin envíos + CTA | No pudimos cargar tu resumen | KPIs y envíos |
| Wizard | Geocodificando / calculando ruta | — | Dirección/ruta inválida | Cotización lista |
| Mis envíos | Skeleton de tabla | Sin envíos / sin resultados | No pudimos cargar tus envíos | Tabla/cards |
| Detalle | Skeleton | — | Envío no encontrado / sin permiso | Detalle completo |
| Ops dashboard | Skeleton de KPIs y cola | Sin pendientes | No pudimos cargar la operación | KPIs + cola |
| Ops detalle | Skeleton | — | Transición inválida / sin recursos | Acción confirmada |
| Reportes | Skeleton de gráficos | Sin datos | No pudimos cargar reportes | Gráficos y tabla |

Reglas:

- Todo error debe tener causa, mensaje y acción sugerida.
- Los errores de formulario se muestran inline y con `aria-live`.
- Las acciones destructivas usan modal de confirmación con motivo cuando aplica.
- Los toasts duran 4 segundos y no tapan la acción principal.

---

## 16. Responsive y accesibilidad

### Breakpoints

- `sm` 360–639: móvil.
- `md` 640–1023: tablet.
- `lg` 1024–1279: desktop chico.
- `xl` 1280+: desktop.

### Reglas responsive

- Portal cliente y tracking: mobile-first.
- Ops: optimizado para desktop; en tablet, sidebar colapsable y tablas con scroll horizontal.
- En móvil, tablas → cards con la misma información y acciones en un menú.
- El wizard mantiene el stepper compacto y el CTA fijo al pie.
- El mapa nunca es la única forma de acceder a la información; siempre hay texto equivalente.

### Accesibilidad

- Contraste mínimo AA (4.5:1 texto normal, 3:1 texto grande).
- Foco visible con anillo de 2px `route-600` y offset de 2px.
- Todos los inputs con label persistente; no usar placeholder como label.
- Navegación completa por teclado; modales con focus trap.
- `aria-live="polite"` para errores y confirmaciones.
- `prefers-reduced-motion` respetado.
- Iconos decorativos con `aria-hidden`; iconos accionables con `aria-label`.

---

## 17. Requisitos no funcionales

| Categoría | Requisito |
|---|---|
| Performance | LCP < 2.5s en landing; API p95 < 500ms sin contar API externa; caché de geocodificación/ruta. |
| Seguridad | Hash Argon2id; cookies httpOnly/secure/sameSite; CORS restringido; Helmet; rate limit en auth y cotización; validación estricta; no exponer stack traces. |
| Disponibilidad | Si la API externa falla, la app sigue operando con fallback y mensajes claros. |
| Observabilidad | Logs estructurados con requestId; healthcheck; métricas básicas de latencia/errores. |
| Mantenibilidad | Arquitectura por capas; módulos NestJS; repositorios; tests de dominio; lint y formato. |
| Escalabilidad | Índices del TP9; paginación en listados; caché externa; sin arrays ilimitados. |
| Compatibilidad | Últimas 2 versiones de Chrome, Firefox, Safari y Edge. |
| Internacionalización | Español Argentina en MVP; estructura preparada para i18n futuro. |

---

## 18. Dependencias, riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Nominatim/OSRM caídos o rate-limited | No se puede cotizar. | Caché, timeout, reintento, fallback con distancia estimada y mensaje claro. |
| Uso justo de OSM | Bloqueo del servicio. | Backend-only, caché agresiva, User-Agent, límite de requests; proveedor con SLA para producción. |
| MongoDB local standalone sin transacciones | Registro usuario+cliente puede quedar inconsistente. | Compensación (rollback lógico) o Atlas/replica set; documentar. |
| Scope creep | No se termina el MVP. | Prioridades P0/P1/P2 y fuera de alcance explícito. |
| Stitch genera pantallas inconsistentes | Retrabajo de UI. | Design system + prompts por pantalla + checklist de consistencia. |
| Auth mal implementada | Vulnerabilidad. | Cookies httpOnly, hash, rate limit, tests, revisión de seguridad. |
| Datos del TP9 con IDs string | Choques o secuencias incorrectas. | Colección `contadores` inicializada desde los datos existentes; tests. |
| Dependencia de una sola persona | Bloqueo. | Documentación y decisiones registradas. |

---

## 19. Decisiones pendientes

1. **Acceso a datos:** driver oficial de MongoDB + repositorios vs. Mongoose.
2. **Refresh token:** access token de 7 días vs. access corto + refresh rotativo con `sesiones`.
3. **Deploy:** Vercel + Render/Railway + Atlas; validar cuentas y límites gratuitos.
4. **Fórmula de cotización:** validar valores propuestos.
5. **Repositorio GitHub:** nombre, visibilidad y cuenta.
6. **Reportes:** confirmar si entran en el MVP o quedan P1.
7. **Logo:** definir si Stitch genera un wordmark o si se usa solo tipografía.
8. **Idioma del código:** inglés para código y español para UI/documentación.

---

## 20. Próximos pasos

1. Revisar y aprobar este PRD.
2. Revisar los wireframes low-fi y los flujos.
3. Generar la identidad visual en Stitch con los prompts.
4. Seleccionar una dirección y documentar el design system final.
5. Diseñar la arquitectura técnica (NestJS + React + MongoDB) y los ADRs.
6. Escribir el plan de implementación por fases.
7. Crear el repositorio GitHub e iniciar el desarrollo.
