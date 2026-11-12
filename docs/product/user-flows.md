# Flujos de usuario — EnvíoYa App

> Diagramas de los recorridos principales. Complementan el PRD y los wireframes.
> Versión 0.1 · 2026-11-12

---

## 1. Mapa general por rol

```mermaid
flowchart LR
  V[Visitante] --> L[Landing]
  L --> T[Tracking público]
  L --> R[Registro]
  L --> I[Login]

  R --> CP[Portal del cliente]
  I --> CP
  CP --> D[Dashboard]
  CP --> N[Nuevo envío]
  CP --> E[Mis envíos]
  CP --> P[Perfil]
  E --> ED[Detalle de envío]
  N --> ED

  I --> OPS[Back-office]
  OPS --> OD[Dashboard operativo]
  OPS --> OB[Bandeja de envíos]
  OB --> OA[Detalle y asignación]
  OPS --> OC[Clientes]
  OPS --> OR[Repartidores y vehículos]
  OPS --> RP[Reportes]
  OPS --> US[Usuarios]
```

---

## 2. Tracking público

```mermaid
flowchart TD
  A[Visitante entra a la landing] --> B{¿Tiene un código?}
  B -- Sí --> C[Ingresa EY-XXXXXX]
  B -- No --> D[Busca el código en su email/comprobante]
  D --> C
  C --> E[Frontend valida formato]
  E -- Inválido --> F[Error inline: formato EY-XXXXXX]
  E -- Válido --> G[GET /public/tracking/:codigo]
  G --> H{¿Existe el envío?}
  H -- No --> I[Empty state: no encontramos ese código]
  H -- Sí --> J{¿La API respondió?}
  J -- Error --> K[Error recuperable + reintentar]
  J -- Sí --> L[Estado + timeline + mapa]
  L --> M[CTA: iniciar sesión para ver más]
  L --> N[CTA: buscar otro envío]
```

**Reglas**

- El tracking público no requiere autenticación.
- Solo muestra datos no sensibles: estado, ciudad, últimos eventos, nombre del repartidor.
- Si el envío está cancelado, muestra el estado y el motivo general, no datos internos.

---

## 3. Registro y login

```mermaid
flowchart TD
  A[Visitante] --> B{¿Tiene cuenta?}
  B -- No --> C[Formulario de registro]
  C --> D[Validación frontend]
  D -- Error --> E[Errores por campo]
  E --> C
  D -- OK --> F[POST /auth/register]
  F --> G{¿Email único?}
  G -- No --> H[Error: email ya registrado]
  H --> C
  G -- Sí --> I[Crear cliente + usuario]
  I --> J[Hash de contraseña y evento de alta]
  J --> K[Login automático]
  K --> L[Redirect según rol]

  B -- Sí --> M[Formulario de login]
  M --> N[POST /auth/login]
  N --> O{¿Credenciales válidas?}
  O -- No --> P[Error genérico + rate limit]
  P --> M
  O -- Sí --> Q[Set cookies httpOnly]
  Q --> L
  L --> R{¿Rol?}
  R -- Cliente --> S[/app]
  R -- Operador/Admin --> T[/ops]
```

**Reglas**

- No revelar si el email existe en el login.
- Rate limit en login y registro.
- La sesión se guarda en cookies httpOnly; el frontend no manipula el token.
- Si el usuario está desactivado, el login responde con un mensaje genérico y no crea sesión.
- El registro crea el cliente y el usuario; si falla uno, se compensa el otro.

---

## 4. Cotización y creación de envío

```mermaid
flowchart TD
  A[Cliente inicia nuevo envío] --> B[Paso 1: origen y destino]
  B --> C[Validar dirección y teléfono]
  C -- Error --> D[Errores inline]
  D --> B
  C -- OK --> E[POST /quotes/geocode]
  E --> F{¿Direcciones encontradas?}
  F -- No --> G[Error: dirección no encontrada]
  G --> B
  F -- Sí --> H[POST /quotes/route]
  H --> I{¿Ruta disponible?}
  I -- No --> J[Ofrecer distancia estimada con advertencia]
  J --> K[Usuario acepta o corrige]
  I -- Sí --> L[Mostrar distancia y tiempo]
  K --> L
  L --> M[Paso 2: paquetes]
  M --> N[Validar peso, dimensiones y frágiles]
  N -- Error --> O[Errores inline]
  O --> M
  N -- OK --> P[Paso 3: cotización]
  P --> Q[POST /quotes/price]
  Q --> R[Desglose: base + km + kg + frágil + seguro]
  R --> S[Cliente confirma]
  S --> T[POST /envios]
  T --> U{¿Datos válidos?}
  U -- No --> V[409/422 + detalle]
  V --> P
  U -- Sí --> W[Crear envío + evento inicial + contador]
  W --> X[Redirect a /app/envios/:id]
  X --> Y[El cliente puede editar/cancelar si sigue pendiente]
```

**Reglas**

- La cotización se calcula en el backend.
- La cotización vale 30 minutos; si vence, se recalcula.
- El envío nace en `pendiente` y sin repartidor.
- El evento inicial es `creado` (tipo `cambio_estado`, estado `pendiente`).
- El código se genera una sola vez y es único.

---

## 5. Gestión del cliente: editar y cancelar

```mermaid
flowchart TD
  A[Cliente abre detalle de envío] --> B{¿Estado?}
  B -- pendiente --> C{¿Tiene repartidor asignado?}
  C -- No --> D[Acciones: editar / cancelar]
  C -- Sí --> E[Acciones: solo cancelar con confirmación]
  B -- en_tránsito/en_sucursal/en_reparto --> F[Solo lectura + tracking]
  B -- entregado/devuelto/cancelado --> G[Solo lectura + comprobante]
  D --> H[Editar dirección/paquetes]
  H --> I[Recalcular cotización]
  I --> J[Guardar cambios + evento]
  D --> K[Cancelar]
  E --> K
  K --> L[Modal: motivo obligatorio]
  L --> M[Confirmar]
  M --> N[Estado cancelado + evento + totalEventos]
  N --> O[El envío queda en historial]
```

**Reglas**

- Editar solo si `pendiente` y sin repartidor.
- Cancelar solo si `pendiente`; el operador puede cancelar `con_incidencia` con motivo.
- Nunca se borra el documento.
- El motivo se guarda en el evento y en `observacion`.

---

## 6. Operación: asignación y transiciones

```mermaid
flowchart TD
  A[Operador entra a /ops] --> B[Ve cola de pendientes]
  B --> C[Abre detalle de envío]
  C --> D[Selecciona repartidor disponible]
  D --> E[Selecciona vehículo operativo]
  E --> F{¿Capacidad suficiente?}
  F -- No --> G[Warning: el vehículo no tiene capacidad]
  G --> D
  F -- Sí --> H[POST /ops/envios/:id/asignar]
  H --> I[Guardar repartidorResumen + vehiculoId]
  I --> J[Acción: Despachar]
  J --> K[Transición pendiente → en_transito]
  K --> L[Evento de tracking + bucket]
  L --> M[En sucursal]
  M --> N[En reparto]
  N --> O{¿Entrega OK?}
  O -- Sí --> P[Entregado + fechaEntrega]
  O -- No --> Q[Incidencia con motivo]
  Q --> R[con_incidencia]
  R --> S[Resolver: reencauzar o devolver]
  S --> T[en_transito/en_sucursal/en_reparto/devuelto/cancelado]
```

**Reglas**

- Solo se muestran transiciones válidas para el estado actual.
- Asignar no cambia el estado; despachar sí.
- Cada transición pide confirmación y, si es destructiva, motivo.
- La asignación valida sucursal, disponibilidad y capacidad.
- El operador no puede editar datos de facturación.

---

## 7. Administración de usuarios

```mermaid
flowchart TD
  A[Admin entra a /ops/usuarios] --> B[Lista de usuarios]
  B --> C[Buscar/filtrar por rol/estado]
  C --> D[Seleccionar usuario]
  D --> E{¿Acción?}
  E -- Cambiar rol --> F[Seleccionar cliente/operador/admin]
  F --> G{¿Es el último admin?}
  G -- Sí --> H[Bloquear: no se puede degradar al último admin]
  G -- No --> I[Guardar cambio + auditoría]
  E -- Activar/desactivar --> J{¿Es uno mismo?}
  J -- Sí --> K[Bloquear auto-desactivación]
  J -- No --> L[Cambiar activo + revocar sesiones]
  E -- Crear operador --> M[Formulario + rol operador]
  M --> N[Crear usuario + invitación o password temporal]
```

**Reglas**

- Un admin no puede degradarse a sí mismo si es el último admin.
- Desactivar un usuario revoca sus sesiones.
- Los operadores no pueden gestionar usuarios.
- Los cambios de rol se registran en una colección de auditoría (P1).

---

## 8. Manejo de errores de la API externa

```mermaid
sequenceDiagram
  autonumber
  participant UI as React
  participant API as NestJS
  participant Cache as MongoDB
  participant OSM as Nominatim/OSRM

  UI->>API: POST /quotes/route
  API->>Cache: buscar ruta por hash origen/destino
  alt cache hit
    Cache-->>API: ruta cacheada
  else cache miss
    API->>OSM: request con timeout 5s
    alt respuesta OK
      OSM-->>API: distancia, duración, geometría
      API->>Cache: guardar con TTL 7 días
    else timeout / 5xx / rate limit
      API-->>UI: 503 { code: EXTERNAL_API_ERROR }
      UI-->>UI: mostrar error + reintentar o distancia estimada
    end
  end
  API-->>UI: cotización con distancia y tiempo
```

**Reglas**

- Reintento automático: 1 vez con backoff de 500 ms.
- Caché de geocodificación: 30 días; ruta: 7 días.
- Si se usa distancia estimada, se marca `estimated: true` y se muestra advertencia.
- El frontend nunca llama a OSM directamente.
- Todos los errores tienen un código estable para tests y analítica.

---

## 9. Estados de sesión y redirecciones

```mermaid
stateDiagram-v2
  [*] --> Visitante
  Visitante --> Autenticando: login/registro
  Autenticando --> Cliente: rol cliente
  Autenticando --> Operador: rol operador
  Autenticando --> Admin: rol admin
  Cliente --> Visitante: logout / expiración
  Operador --> Visitante: logout / expiración
  Admin --> Visitante: logout / expiración
  Cliente --> Cliente: refresh de sesión
  Operador --> Operador: refresh de sesión
  Admin --> Admin: refresh de sesión
```

**Reglas**

- Cliente que intenta entrar a `/ops` → 403 + redirect a `/app`.
- Operador/admin que intenta entrar a `/app` → puede ver su perfil, pero no envíos de cliente.
- Sesión expirada → redirect a login con `returnTo`.
```
