# Prompts para Google Stitch — EnvíoYa

> Guía para generar la identidad visual y los mockups de las pantallas principales.
> Versión 0.1 · 2026-11-12
> Documento base: [`PRD.md`](./PRD.md) · Sistema de diseño: [`DESIGN.md`](./DESIGN.md)

---

## 1. Cómo usar este documento

Stitch funciona mejor si primero se define un **sistema** y después se generan las pantallas con ese sistema como referencia. No conviene pedir “una app de logística” y esperar consistencia mágica.

Orden recomendado:

1. Crear un proyecto **Web** en Stitch.
2. Pegar el **master prompt** (sección 3) y generar 3 variantes.
3. Elegir la variante con mejor tipografía, jerarquía y layout.
4. Generar un **design system board** (sección 5) y ajustar tokens.
5. Generar las pantallas P0 en el orden indicado (sección 6).
6. Para cada pantalla, usar el prompt específico y pedir explícitamente consistencia con el design system.
7. Exportar screenshots/HTML y guardarlos en `docs/design/stitch/`.
8. Registrar qué se aceptó, qué se cambió y qué se descartó en `docs/design/design-review.md`.

> **Idioma:** los prompts están en inglés porque Stitch suele responder mejor; el **copy de la UI debe quedar en español (Argentina)**. Cada prompt lo aclara.

---

## 2. Workflow de generación

### Fase A — Exploración de identidad

- Generar 3 variantes del master prompt.
- Comparar: tipografía, uso del color, densidad, originalidad, legibilidad.
- Elegir una base y descartar las otras (no mezclar pantallas de sistemas distintos).

### Fase B — Sistema

- Generar el design system board.
- Ajustar paleta, tipografía, botones, chips, timeline, tabla y mapa.
- Guardar una captura como referencia visual.

### Fase C — Pantallas

- Generar en este orden: landing → tracking → auth → dashboard cliente → wizard (3 pasos) → mis envíos → detalle → ops dashboard → ops queue → ops detail → reports → mobile tracking.
- Después de cada pantalla, pedir “keep the same design system and components”.
- Si una pantalla sale inconsistente, no parchear: regenerarla con el prompt + una captura de referencia.

### Fase D — Revisión

- Revisar contra el checklist de la sección 8.
- Documentar desvíos.
- Recién después traducir a componentes React.

---

## 3. Master prompt (inglés, recomendado)

```text
Design a high-fidelity web application UI for EnvíoYa, a national logistics and parcel company in Argentina. The product has three connected surfaces: a public marketing + tracking site, a client portal, and an operations back-office for staff.

BRAND CONCEPT
"Control Tower / Wayfinding": EnvíoYa turns the chaos of shipping into a clear route. The visual language borrows from transit maps, airport wayfinding, parcel labels, and operations dashboards. It should feel precise, human, and quietly optimistic — not like generic corporate SaaS.

VISUAL DIRECTION
- Warm paper background (#F6F2E9), deep ink (#0B1220), safety orange (#D93A00) for primary actions and active routes, route blue (#1D4ED8) for links and in-transit states, mint (#B9F27C) for delivered/success.
- Typography: Archivo for display and headings, Inter for body, IBM Plex Mono for tracking codes, timestamps, and IDs.
- Functional geometry: 4px input radius, 8px card radius, 1px sand borders (#D8D0C0), almost no shadows. Generous whitespace on public pages; dense but readable tables in ops.
- Route lines are a recurring motif: solid for completed, dashed for pending, orange for active. Use them in timelines, steppers, maps, and empty states.
- Real logistics content: maps, package labels, status chips, timestamps. No stock photos of smiling couriers, no 3D blobs, no purple gradients, no glassmorphism.
- Iconography: Lucide, 1.5px stroke.
- Accessibility: WCAG AA contrast, visible focus rings, 44px touch targets.

PRODUCT SURFACES
1. Public site: landing page, public tracking result, login, register.
2. Client portal: dashboard, new shipment wizard (3 steps), my shipments, shipment detail, profile.
3. Ops back-office: dashboard, shipment queue, shipment detail/assignment, clients, couriers/vehicles, reports, users.

LAYOUT
- Public pages: top navigation, max-width 1200, generous hero.
- Client portal: light sidebar (248px), top bar with tracking search, content cards on warm paper.
- Ops back-office: deep ink sidebar (248px), dense top bar, data tables, map panel, status chips.

LANGUAGE AND DATA
- All UI copy in Spanish (Argentina).
- Currency in ARS, dates in DD/MM/YYYY.
- Use realistic sample data: EY-4F8A1C, Córdoba → Rosario, 401 km, 4 h 35 min, 2 paquetes, 7.3 kg, ARS 81.700.
- Status vocabulary: Pendiente, En tránsito, En sucursal, En reparto, Entregado, Con incidencia, Devuelto, Cancelado.
- Do not use lorem ipsum.

CONSISTENCY RULES
- Use the same header, sidebar, buttons, inputs, status chip, timeline, and map style across all screens.
- One primary orange CTA per screen.
- Do not invent features outside the screen list (no payments, chat, social feed, or live GPS).
- Show loading, empty, and error states only when explicitly requested.
```

### Versión condensada (si Stitch limita el largo)

```text
Design a high-fidelity logistics web app called EnvíoYa (Argentina) with a public site, client portal, and ops back-office. Brand concept: "Control Tower / Wayfinding" — transit maps, parcel labels, operations dashboards. Palette: ink #0B1220, warm paper #F6F2E9, safety orange #D93A00, route blue #1D4ED8, mint #B9F27C, sand #D8D0C0. Type: Archivo display, Inter body, IBM Plex Mono codes. 4px inputs, 8px cards, 1px borders, almost no shadows. Route lines as motif: solid completed, dashed pending, orange active. Spanish (Argentina) copy, ARS, realistic data (EY-4F8A1C, Córdoba → Rosario, 401 km, 2 paquetes, ARS 81.700). No purple gradients, glassmorphism, 3D blobs, or stock photos. Screens: landing, public tracking, login, register, client dashboard, new shipment wizard (3 steps), my shipments, shipment detail, ops dashboard, ops queue, ops detail/assignment, reports, mobile tracking.
```

---

## 4. Master prompt en español (opcional)

```text
Diseñá una interfaz web de alta fidelidad para EnvíoYa, una empresa nacional de logística y paquetería de Argentina. El producto tiene tres superficies conectadas: sitio público con tracking, portal de clientes y back-office operativo.

CONCEPTO DE MARCA
"Torre de control / Wayfinding": EnvíoYa convierte el caos del envío en una ruta clara. El lenguaje visual toma prestado de mapas de transporte, señalética de aeropuertos, etiquetas de paquetería y tableros de operaciones. Debe sentirse preciso, humano y optimista; no un SaaS corporativo genérico.

DIRECCIÓN VISUAL
- Fondo papel cálido (#F6F2E9), tinta profunda (#0B1220), naranja de seguridad (#D93A00) para acciones principales y rutas activas, azul ruta (#1D4ED8) para links y estados en tránsito, menta (#B9F27C) para entregado/éxito.
- Tipografía: Archivo para títulos, Inter para cuerpo, IBM Plex Mono para códigos de tracking, timestamps e IDs.
- Geometría funcional: inputs de 4px, cards de 8px, bordes de 1px color arena (#D8D0C0), casi sin sombras. Espacio generoso en público; tablas densas y legibles en ops.
- Líneas de ruta como motivo recurrente: sólidas para completado, punteadas para pendiente, naranjas para activo. Usarlas en timelines, steppers, mapas y empty states.
- Contenido real de logística: mapas, etiquetas de paquetes, chips de estado, timestamps. Sin fotos de stock de repartidores sonriendo, sin blobs 3D, sin gradientes violetas, sin glassmorphism.
- Iconografía Lucide, stroke 1.5px.
- Accesibilidad AA, foco visible, targets de 44px.

SUPERFICIES
1. Público: landing, tracking público, login, registro.
2. Portal del cliente: dashboard, wizard de nuevo envío (3 pasos), mis envíos, detalle, perfil.
3. Back-office: dashboard operativo, bandeja, detalle/asignación, clientes, repartidores/vehículos, reportes, usuarios.

LAYOUT
- Público: top nav, max-width 1200, hero generoso.
- Portal cliente: sidebar clara de 248px, top bar con búsqueda de tracking, cards sobre papel.
- Ops: sidebar oscura de 248px, top bar densa, tablas, mapa, chips.

IDIOMA Y DATOS
- Todo el copy en español (Argentina).
- Moneda ARS, fechas DD/MM/YYYY.
- Datos realistas: EY-4F8A1C, Córdoba → Rosario, 401 km, 4 h 35 min, 2 paquetes, 7.3 kg, ARS 81.700.
- Estados: Pendiente, En tránsito, En sucursal, En reparto, Entregado, Con incidencia, Devuelto, Cancelado.
- No usar lorem ipsum.

CONSISTENCIA
- Mismo header, sidebar, botones, inputs, chips, timeline y mapas en todas las pantallas.
- Un solo CTA naranja por pantalla.
- No inventar funciones fuera de la lista (sin pagos, chat, feed social ni GPS en vivo).
```

---

## 5. Prompt para el design system board

```text
Create a design system board for EnvíoYa, a logistics web app. One artboard, organized in sections.

BRAND: "Control Tower / Wayfinding". Precise, human, operational. Warm paper, deep ink, safety orange, route blue, mint.

COLOR TOKENS
Ink #0B1220 · Paper #F6F2E9 · Surface #FFFFFF · Sand #D8D0C0 · Signal #D93A00 · Signal bright #FF5A1F · Route #1D4ED8 · Mint #B9F27C · Danger #B42318 · Warning #F59E0B.

TYPE
Archivo 600/700 (display), Inter 400/500/600 (body), IBM Plex Mono 400/500 (codes, timestamps). Show the scale: 56, 40, 32, 24, 20, 18, 16, 14, 12.

COMPONENTS
- Buttons: primary, secondary, outline, ghost, danger, link; default/compact/hero; hover/focus/disabled/loading.
- Inputs: text, select, textarea, checkbox, toggle, code input; default/focus/error/disabled; label + helper + error.
- Status chips: Pendiente, En tránsito, En sucursal, En reparto, Entregado, Con incidencia, Devuelto, Cancelado.
- Cards: default, KPI, map, empty state.
- Data table: header, row, status, actions, pagination.
- Tracking timeline: completed, current, future.
- Stepper: completed, current, future.
- Map: light desaturated tiles, orange route, ink markers, distance/time overlay.
- Modal, toast, tooltip, breadcrumbs, avatar, badge.
- Empty state with route-line illustration.

STYLE
Warm paper background, 1px sand borders, 8px card radius, 4px input radius, almost no shadows. Generous spacing. No purple gradients, no glassmorphism, no 3D blobs. Spanish labels, ARS currency.
```

---

## 6. Prompts por pantalla

> Usar siempre después de haber generado el design system. Cada prompt asume que el sistema ya existe. Si Stitch pierde consistencia, adjuntar una captura de referencia.

### P-01 · Landing

```text
Use the EnvíoYa design system. Design the public landing page, desktop 1440x900.

Top navigation: EnvíoYa wordmark left; links Servicios, Seguimiento, Empresas; ghost button "Ingresar"; primary button "Cotizar envío". Warm paper background.

Hero split 55/45. Left: eyebrow "LOGÍSTICA NACIONAL"; H1 "Tu envío, en el mapa. Sin sorpresas."; subheadline "Cotizá, despachá y seguí cada paquete desde un solo lugar."; tracking input with placeholder "Ingresá tu código EY-XXXXXX" and secondary button "Seguir envío"; primary CTA "Cotizar envío"; small trust line "Sin cuenta para seguir un envío". Right: a stylized light map card with an orange route line from Córdoba to Rosario, origin/destination pins, and a floating status card: "EN TRÁNSITO · Córdoba → Rosario · Llega mañana 18:00".

Below hero: trust strip with three metrics ("+12.000 envíos", "98% a tiempo", "Cobertura nacional"). Three service cards: "Particulares", "Empresas", "Seguimiento". A "Cómo funciona" section with 3 numbered steps and route-line connectors. Final CTA band: "Cotizá tu próximo envío" with primary button. Footer with columns.

Use Archivo, Inter, IBM Plex Mono. One primary orange CTA per view. No stock photos, no 3D illustrations. Spanish copy, ARS.
```

### P-02 · Tracking público

```text
Use the EnvíoYa design system. Design the public tracking result page, desktop 1440x900.

Compact top nav with EnvíoYa wordmark and "Ingresar". A centered tracking search bar showing code "EY-4F8A1C" and a "Buscar" button. Status header: code in IBM Plex Mono, status chip "En tránsito", headline "Tu envío está en camino.", ETA "Llega mañana antes de las 18:00", route "Córdoba → Rosario".

Two-column layout: left (60%) vertical tracking timeline with completed, current, and future events: "Despachado desde Sucursal Córdoba" (10/11 18:00), "En tránsito por Ruta 9" (11/11 06:00, current, orange node), "Llegó a Sucursal Rosario" (estimado 11/11 14:00), "En reparto" (estimado 12/11 08:00), "Entregado" (estimado 12/11 18:00). Right (40%): map card with orange route line and markers; summary card with origin, destination, 2 paquetes, 7.3 kg, repartidor "Carlos Díaz"; link "Iniciar sesión para ver más".

Footer help: "¿Problemas con tu envío? Contactanos." Use warm paper, sand borders, mint for delivered, route blue for in-transit. Spanish copy.
```

### P-03 · Login

```text
Use the EnvíoYa design system. Design the login page, desktop 1440x900.

Split screen 45/55. Left: warm paper background, EnvíoYa wordmark, heading "Ingresá a tu cuenta", subtext "Gestioná tus envíos y seguí cada paquete.", form with email, password (with show/hide icon), "Recordarme" checkbox, link "Olvidé mi contraseña", primary button "Ingresar", divider, secondary link "Crear cuenta". Inline error state example: "Email o contraseña incorrectos." with a red border on the password field.

Right: deep ink panel with a light map/route illustration, a floating tracking card "EY-4F8A1C · En tránsito · Llega mañana 18:00", and a short value prop "Todo tus envíos, en un solo lugar." Use route lines as subtle decoration. No stock photos.

Accessibility: visible labels, focus ring, 44px targets. Spanish copy.
```

### P-04 · Registro

```text
Use the EnvíoYa design system. Design the registration page, desktop 1440x900, same split-screen layout as login.

Left: heading "Creá tu cuenta", subtext "Cotizá y seguí tus envíos en minutos." Form: nombre y apellido, email, teléfono, contraseña, confirmar contraseña, checkbox "Acepto los términos y condiciones", primary button "Crear cuenta", link "Ya tengo cuenta". Show a password strength helper: "Mínimo 8 caracteres, una mayúscula y un número." Show one inline error example on email: "Ya existe una cuenta con este email."

Right: same brand panel as login but with a different route illustration and a small "Cómo funciona" 3-step mini list: "1. Cotizá, 2. Confirmá, 3. Seguí". Spanish copy, warm paper, ink panel, orange CTA.
```

### C-01 · Dashboard cliente

```text
Use the EnvíoYa design system. Design the client dashboard, desktop 1440x900.

App shell: light sidebar 248px with EnvíoYa wordmark, nav items Inicio (active), Mis envíos, Nuevo envío, Perfil; bottom user card "Lucía Ramírez". Top bar with tracking search, notification bell, avatar.

Content on warm paper: greeting "Hola, Lucía" + subtext "Esto es lo que está pasando con tus envíos." Two quick actions: primary "Cotizar envío" and outline "Seguir un envío". Three KPI cards: "Envíos activos" 2, "Entregados este mes" 14, "Gasto del mes" ARS 124.500. Recent shipments table: EY-4F8A1C · Rosario · En tránsito · 12/11 · ARS 81.700; EY-9X8Y7Z · Mendoza · Entregado · 08/11 · ARS 42.300; EY-1B3C5D · La Plata · Pendiente · 12/11 · ARS 17.000. Right-side map card "Tu envío activo" with orange route Córdoba → Rosario and ETA.

Use status chips, mono codes, tabular numbers. One primary CTA. Spanish copy, ARS.
```

### C-02 · Nuevo envío — Paso 1

```text
Use the EnvíoYa design system. Design step 1 of the new shipment wizard, desktop 1440x900.

App shell: light sidebar, top bar. Content: back link "Mis envíos", page title "Nuevo envío", subtitle "Paso 1 de 3 · Origen y destino". Horizontal stepper: 1 Origen y destino (active), 2 Paquetes, 3 Cotización.

Two columns: left form card (60%) with "Origen" prefilled card (Lucía Ramírez, Av. Rivadavia 4321, CABA, +54 11 5555-2345) and "Destino" form (nombre, calle y número, ciudad, provincia, CP, teléfono, notas). Primary button "Calcular ruta". Right (40%): map card with route preview placeholder, distance/time card "401 km · 4 h 35 min", and a tip "Usamos OpenStreetMap para calcular la ruta."

Show inline validation examples: "Ingresá el número" on street, and a warning state "No encontramos esta dirección. Revisá calle, número y ciudad." Spanish copy, warm paper, orange CTA.
```

### C-03 · Nuevo envío — Paso 2

```text
Use the EnvíoYa design system. Design step 2 of the new shipment wizard, desktop 1440x900.

Same app shell and stepper, now step 2 "Paquetes" active. Left (65%): heading "¿Qué viaja?" and subtitle "Agregá cada paquete con su peso y dimensiones." Two package cards: "Paquete 1" with descripción "Caja de repuestos", peso 4.5 kg, dimensiones 30x40x25 cm, toggle "Frágil" on, valor declarado ARS 120.000; "Paquete 2" with "Caja de herramientas", 2.8 kg, 20x30x20 cm, frágil off, valor declarado ARS 45.000. "Agregar paquete" dashed button. Inline error example on weight: "El peso debe ser mayor a 0."

Right (35%): sticky summary card "Resumen" with 2 paquetes, 7.3 kg, 1 frágil, valor declarado ARS 165.000; primary button "Continuar"; ghost "Volver". Small note: "El peso y la fragilidad afectan el costo." Spanish copy, ARS.
```

### C-04 · Nuevo envío — Paso 3

```text
Use the EnvíoYa design system. Design step 3 of the new shipment wizard, desktop 1440x900.

Same app shell and stepper, step 3 "Cotización" active. Left (60%): heading "Todo listo para confirmar", route summary card with map thumbnail, "Córdoba → Rosario", "401 km · 4 h 35 min", "2 paquetes · 7.3 kg". Cost breakdown card: Flete base ARS 3.500; Distancia 401 km ARS 72.180; Peso 7.3 kg ARS 1.825; Frágil ARS 800; Seguro (toggle on) ARS 3.300; divider; Total ARS 81.700. Note "Cotización válida por 30 minutos." Primary button "Confirmar envío"; ghost "Volver a editar".

Right (40%): destination summary, package list, and a trust card "Pago por envío" / "Facturación mensual" depending on client type. Show a subtle warning example: "La cotización venció. Recalculá el precio para continuar." Spanish copy, ARS.
```

### C-05 · Mis envíos

```text
Use the EnvíoYa design system. Design the client shipments list, desktop 1440x900.

App shell with sidebar "Mis envíos" active. Content: header "Mis envíos" + primary button "Nuevo envío". Search input "Buscar por código o destino". Filter chips: Todos, Pendiente, En tránsito, Entregado, Cancelado. Date range filter. Data table with columns: Código (mono), Destino, Estado (chip), Creado, ETA, Total (ARS, right aligned), Acciones (three-dot menu). Rows: EY-4F8A1C Rosario En tránsito 10/11 12/11 18:00 ARS 81.700; EY-9X8Y7Z Mendoza Entregado 05/11 08/11 ARS 42.300; EY-1B3C5D La Plata Pendiente 12/11 13/11 ARS 17.000; EY-7K2M4P Salta Con incidencia 03/11 — ARS 56.400. Pagination at bottom.

Empty state variant: route-line illustration, "Todavía no tenés envíos", "Cotizá el primero y seguilo desde acá", primary "Cotizar envío". Spanish copy, warm paper, sand borders.
```

### C-06 · Detalle de envío (cliente)

```text
Use the EnvíoYa design system. Design the client shipment detail page, desktop 1440x900.

App shell. Back link "Mis envíos". Header: code EY-4F8A1C in mono, status chip "En tránsito", headline "Tu envío está en camino.", ETA "Llega mañana antes de las 18:00", route "Córdoba → Rosario". Actions: outline "Copiar código", ghost "Cancelar envío" (only if pending; show disabled state with tooltip "Ya fue despachado"). Two columns: left (60%) tracking timeline with 5 events; right (40%) map card with orange route and markers, courier card "Carlos Díaz · +54 351 555-0101", summary card with 2 paquetes, 7.3 kg, ARS 81.700.

Below: tabs "Paquetes", "Direcciones", "Costo". Show package cards and cost breakdown. Cancellation modal example: "¿Cancelar este envío?", "El envío quedará cancelado y no se podrá recuperar.", motivo select, danger button "Cancelar envío", ghost "Volver". Spanish copy, ARS.
```

### O-01 · Dashboard operativo

```text
Use the EnvíoYa design system. Design the operations dashboard, desktop 1440x900.

App shell with deep ink sidebar 248px: EnvíoYa wordmark, nav Dashboard (active), Envíos, Clientes, Repartidores, Reportes, Usuarios. Top bar: branch selector "Sucursal Córdoba", search, avatar, notification bell.

Content: header "Operación de hoy" + date "12/11/2026" + filter "Últimas 24 h". Four KPI cards: "Pendientes" 18, "En tránsito" 42, "Con incidencia" 3, "Entregados hoy" 27. Main grid: left (65%) priority queue table with columns Código, Cliente, Destino, Estado, Repartidor, Acción; rows include EY-4F8A1C Andes Logística Rosario En tránsito Carlos Díaz; EY-1B3C5D Distribuidora Norte La Plata Pendiente — Assign button; EY-7K2M4P Ferretería Norte Salta Con incidencia — Review button. Right (35%): map card with active routes and a list of available couriers "3 disponibles". Bottom: alerts panel with 2 incidents.

Dense but readable, status chips, mono codes. One orange CTA per row at most. Spanish copy, ARS.
```

### O-02 · Bandeja de envíos

```text
Use the EnvíoYa design system. Design the ops shipment queue, desktop 1440x900.

Deep ink sidebar with "Envíos" active. Header "Envíos" + count "128 en total". Search bar, filters: Sucursal, Fecha, Repartidor. Status tabs with counts: Todos 128, Pendientes 18, En tránsito 42, En sucursal 12, En reparto 9, Entregados 27, Incidencias 3, Cancelados 2. Data table with columns: Código, Cliente, Destino, Estado, Repartidor, Creado, Total, Acciones. 8 rows with realistic data. Row actions: "Asignar" for pending, "Ver" for others; three-dot menu.

Pagination, bulk selection not needed. Empty state variant: "No hay envíos con estos filtros." Spanish copy, dense table, sand borders, status chips.
```

### O-03 · Detalle y asignación (ops)

```text
Use the EnvíoYa design system. Design the ops shipment detail and assignment page, desktop 1440x900.

Deep ink sidebar. Header: code EY-4F8A1C, status chip "Pendiente", client "Andes Logística S.A.", route "Córdoba → Rosario", total ARS 81.700. Actions: primary "Asignar recursos", ghost "Cambiar estado", danger outline "Cancelar envío".

Three-column layout: left (40%) tracking timeline + packages; center (35%) map card with route; right (25%) assignment panel: select Repartidor ("Carlos Díaz · disponible"), select Vehículo ("Ford Transit · 1.200 kg"), branch "Sucursal Córdoba", capacity indicator "7.3 / 1.200 kg", note "El repartidor no cambia el estado; el despacho es una acción separada." Primary "Asignar", ghost "Desasignar".

Below: status transition panel with only valid transitions: "Despachar", "Registrar incidencia"; invalid transitions disabled with tooltip. Internal notes textarea. Confirmation modal example for cancellation with required reason. Spanish copy, ARS.
```

### O-06 · Reportes

```text
Use the EnvíoYa design system. Design the reports page, desktop 1440x900.

Deep ink sidebar with "Reportes" active. Header "Reportes" + filters: date range "01/11/2026 – 12/11/2026", Sucursal "Todas", button "Exportar CSV" (outline). KPI row: "Envíos" 128, "Tiempo promedio" 2.4 días, "A tiempo" 94%, "Incidencias" 3. Charts: bar chart "Envíos por sucursal" (Córdoba 42, Rosario 31, CABA 28, Mendoza 15, Salta 12); line chart "Tiempo promedio de entrega" by week; donut "Distribución por estado". Table "Top repartidores": Carlos Díaz 38 entregas 4.8, Ana Ruiz 31 4.9, Diego Paz 27 4.6. Insight card: "Córdoba mejoró 12% vs. el período anterior."

Charts in ink, route blue, signal orange, mint; no rainbow palettes. Spanish copy, ARS. Empty state: "No hay datos para el período seleccionado."
```

### P-02-mobile · Tracking en móvil

```text
Use the EnvíoYa design system. Design the public tracking result page for mobile 390x844.

Compact top bar with EnvíoYa wordmark and menu icon. Search input with code EY-4F8A1C. Status header: chip "En tránsito", headline "Tu envío está en camino.", ETA "Llega mañana antes de las 18:00", route "Córdoba → Rosario". Map card full width with orange route. Vertical timeline below with 5 events, current node orange. Bottom sticky bar: primary "Iniciar sesión" and ghost "Buscar otro envío". Use warm paper, sand borders, mono code. Spanish copy.
```

---

## 7. Prompts de iteración

Usar estos prompts para corregir sin regenerar todo:

```text
Keep the same layout but make the typography more editorial: larger Archivo headlines, tighter tracking, more whitespace, fewer rounded corners.
```

```text
Reduce the palette to ink, paper, safety orange, route blue, mint, sand, and danger. Remove any other accent color.
```

```text
Replace the generic illustration with a route-line diagram: thin lines, nodes, dashed future segments, orange active segment.
```

```text
Make the map panel the hero of this screen, but keep the timeline readable. Use a light desaturated map, orange route, ink markers.
```

```text
Use the same status chip component and the same data table header as the previous screens. Do not change the design system.
```

```text
Show the empty, loading, and error states for this screen in three separate variants.
```

```text
Make this screen more operationally dense: smaller row height, more columns, sticky header, clear row actions. Do not sacrifice legibility.
```

---

## 8. Checklist de consistencia

- [ ] Paleta limitada a ink, paper, signal, route, mint, danger, sand.
- [ ] Archivo/Inter/IBM Plex Mono en todos los títulos, body y códigos.
- [ ] Un solo CTA naranja por pantalla.
- [ ] Chips de estado con el mismo componente y colores.
- [ ] Timeline con línea sólida/punteada y nodo actual naranja.
- [ ] Mapas con ruta naranja y marcadores tinta.
- [ ] Cards con borde 1px y radio 8px.
- [ ] Tablas densas, header sticky, números alineados a la derecha.
- [ ] Empty states con línea de ruta, no personajes.
- [ ] Copy en español Argentina y ARS.
- [ ] Sin gradientes violetas, glassmorphism, blobs 3D ni fotos de stock.
- [ ] Foco visible y contraste AA en las vistas principales.

---

## 9. Qué evitar

- **No** pedir “una app de logística moderna” sin más contexto: sale genérico.
- **No** mezclar pantallas de distintas generaciones del design system.
- **No** aceptar texto en inglés si la UI debe estar en español.
- **No** usar lorem ipsum: los datos reales ayudan a evaluar jerarquía y densidad.
- **No** agregar features que no estén en el PRD.
- **No** usar sombras difusas en todas las cards ni radios de 20px.
- **No** convertir el dashboard del cliente en un panel de analytics.

---

## 10. Exportación y documentación

1. Exportar cada pantalla aceptada como PNG (y HTML si Stitch lo permite).
2. Guardar en `docs/design/stitch/<pantalla>/`.
3. Nombrar con el ID del PRD: `P-01-landing.png`, `C-04-cotizacion.png`, etc.
4. Crear `docs/design/design-review.md` con:
   - Variante elegida y por qué.
   - Pantallas aceptadas.
   - Desvíos respecto del PRD.
   - Componentes nuevos que surgieron.
   - Decisiones pendientes para la implementación React.
5. Actualizar el decision log si cambia alguna decisión de producto o diseño.
