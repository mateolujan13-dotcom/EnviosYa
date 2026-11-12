# DESIGN.md — EnvíoYa

> Sistema de diseño para la identidad visual y los mockups en Google Stitch.
> Versión 0.1 · 2026-11-12 · Estado: propuesta para validación.

---

## 1. Esencia de marca

**Concepto:** *Control Tower / Wayfinding.*
EnvíoYa convierte el caos del envío en una ruta clara. La identidad toma prestado el lenguaje de los mapas de transporte, la señalética de aeropuertos y las etiquetas de paquetería: líneas, nodos, códigos, timestamps y direcciones.

**Personalidad:** precisa, humana, operativa, optimista. No es una startup genérica de gradientes violetas ni un banco corporativo.

**Promesa:** “Tu envío, en el mapa. Sin sorpresas.”

**Palabras clave:** ruta, nodo, señal, destino, control, claridad, movimiento.

---

## 2. Logo y wordmark (dirección)

- Wordmark **“EnvíoYa”** en Archivo Bold, tracking negativo.
- La “Y” puede resolverse como una bifurcación de ruta: dos líneas que se encuentran y siguen.
- Alternativa: un pin cuadrado con una línea de ruta interna.
- No usar mascotas, camiones caricaturescos ni globos terráqueos.
- Versión principal en tinta sobre papel; versión invertida en papel sobre tinta.
- Área de resguardo: altura de la “E” alrededor del wordmark.

> Stitch puede proponer el wordmark, pero la prioridad de los mockups es la UI. Si el logo no queda bien, usar solo tipografía.

---

## 3. Paleta

### 3.1 Colores base

| Token | Hex | Uso | Contraste sugerido |
|---|---|---|---|
| `ink-950` | `#08111F` | Sidebar ops, fondos oscuros, texto principal. | Texto claro sobre este fondo. |
| `ink-900` | `#0B1220` | Títulos, botones secundarios, superficies oscuras. | AAA con blanco. |
| `ink-700` | `#1E2A3B` | Texto secundario fuerte, bordes oscuros. | AA con paper. |
| `ink-500` | `#4B5563` | Texto secundario, labels. | AA con paper. |
| `paper` | `#F6F2E9` | Fondo público y portal cliente. | Base cálida. |
| `surface` | `#FFFFFF` | Tarjetas, tablas, modales. | — |
| `sand-200` | `#E7DFD1` | Fondos sutiles, hover. | — |
| `sand-300` | `#D8D0C0` | Bordes, divisores. | — |
| `signal-600` | `#D93A00` | CTA primario, ruta activa, foco de acción. | Blanco: ~4.6:1. |
| `signal-500` | `#FF5A1F` | Acentos, alertas suaves, íconos. | Usar con texto tinta. |
| `route-600` | `#1D4ED8` | Links, estados en tránsito, foco. | AA con paper. |
| `route-100` | `#DBEAFE` | Fondos de chips informativos. | — |
| `mint-300` | `#B9F27C` | Éxito, entregado, confirmaciones. | Texto tinta. |
| `mint-100` | `#ECFCCB` | Fondo de chips de éxito. | — |
| `danger-600` | `#B42318` | Errores, incidencias, acciones destructivas. | Blanco: AA. |
| `danger-100` | `#FEE4E2` | Fondo de chips de error. | — |
| `warning-500` | `#F59E0B` | Advertencias, pendientes. | Texto tinta. |

### 3.2 Colores de estado

| Estado | Fondo | Texto | Punto |
|---|---|---|---|
| Pendiente | `sand-200` | `ink-700` | `ink-500` |
| En tránsito | `route-100` | `route-600` | `route-600` |
| En sucursal | `#EDE9FE` | `#6D28D9` | `#7C3AED` |
| En reparto | `#FFEDD5` | `#C2410C` | `signal-500` |
| Entregado | `mint-100` | `#4D7C0F` | `#65A30D` |
| Con incidencia | `danger-100` | `danger-600` | `danger-600` |
| Devuelto | `#F3F4F6` | `ink-500` | `ink-500` |
| Cancelado | `#F3F4F6` | `ink-500` | `ink-500` |

### 3.3 Reglas de uso

- El naranja (`signal`) es **acción**, no decoración. Máximo un CTA primario por pantalla.
- El azul (`route`) es **información y navegación**. No usarlo para botones primarios.
- El verde (`mint`) es **éxito**. No usarlo para acciones.
- El rojo (`danger`) es **error/incidencia**. No usarlo para énfasis.
- No usar gradientes de fondo. Excepción: overlay de mapa o transición de opacidad.
- No usar glassmorphism, neón ni sombras de colores.

---

## 4. Tipografía

### 4.1 Familias

| Rol | Familia | Pesos | Uso |
|---|---|---|---|
| Display | **Archivo** | 600, 700 | H1–H3, números grandes, wordmark. |
| Body | **Inter** | 400, 500, 600 | Párrafos, labels, tablas, botones. |
| Mono | **IBM Plex Mono** | 400, 500 | Códigos EY-XXXXXX, IDs, timestamps, distancias. |

Fallbacks: `Archivo, "Arial Narrow", sans-serif`; `Inter, system-ui, sans-serif`; `"IBM Plex Mono", ui-monospace, monospace`.

### 4.2 Escala

| Token | Tamaño / línea | Uso |
|---|---|---|
| `display-xl` | 56 / 60 | Hero desktop. |
| `display-lg` | 40 / 44 | Títulos de sección. |
| `display-md` | 32 / 36 | Títulos de página. |
| `heading-lg` | 24 / 30 | Títulos de card. |
| `heading-md` | 20 / 26 | Subtítulos. |
| `body-lg` | 18 / 28 | Texto destacado. |
| `body-md` | 16 / 24 | Texto base. |
| `body-sm` | 14 / 20 | Tablas, labels. |
| `caption` | 12 / 16 | Metadatos, helpers. |
| `mono-code` | 13 / 18 | Códigos y timestamps. |

### 4.3 Reglas

- Tracking negativo (-0.02em) en display; 0 en body; +0.08em en labels uppercase.
- No usar más de tres tamaños de título por pantalla.
- Los números de KPI usan Archivo Bold con `font-variant-numeric: tabular-nums`.
- Los códigos de tracking siempre en IBM Plex Mono, mayúsculas, con letter-spacing 0.04em.

---

## 5. Espaciado, grid y layout

### 5.1 Espaciado

Escala base 4px: `4, 8, 12, 16, 24, 32, 48, 64, 96`.
- Padding de card: 24px.
- Gap entre cards: 16px (mobile), 24px (desktop).
- Padding de página: 24px mobile, 40px tablet, 64px desktop.
- Separación entre secciones públicas: 96px desktop, 64px mobile.

### 5.2 Grid

- 12 columnas.
- Max-width: 1440px para app; 1200px para público.
- Gutters: 24px.
- La app shell ocupa el 100% del viewport; el contenido respeta max-width 1440.

### 5.3 App shell

**Cliente**
- Sidebar clara de 248px (paper/surface), borde derecho sand.
- Top bar de 64px con búsqueda de tracking, notificaciones y avatar.
- Contenido con padding 32px.

**Ops**
- Sidebar oscura de 248px (`ink-950`), texto `#94A3B8`.
- Item activo con fondo `signal-600` y texto blanco.
- Top bar de 64px con sucursal activa, búsqueda y avatar.
- Contenido denso: padding 24px, tablas full-width.

**Público**
- Top nav de 72px, transparente sobre paper, con borde inferior al hacer scroll.
- Hero max-width 1200.

### 5.4 Radios y bordes

| Elemento | Radio |
|---|---|
| Inputs, selects, botones | 4px |
| Cards, modales | 8px |
| Chips, avatares | 999px |
| Tablas | 8px (contenedor) |

- Bordes: 1px solid `sand-300` en superficies claras; 1px solid rgba(255,255,255,.08) en oscuras.
- Sombras: solo para modales/dropdowns: `0 8px 24px rgba(8,17,31,.12)`. Evitar sombras en cards.

---

## 6. Componentes

### 6.1 Botones

| Variante | Fondo | Texto | Borde | Uso |
|---|---|---|---|---|
| Primary | `signal-600` | blanco | ninguno | Acción principal. |
| Secondary | `ink-900` | blanco | ninguno | Acción secundaria fuerte. |
| Outline | transparente | `ink-900` | `sand-300` | Acción terciaria. |
| Ghost | transparente | `ink-700` | ninguno | Navegación, acciones suaves. |
| Danger | `danger-600` | blanco | ninguno | Cancelar/eliminar. |
| Link | transparente | `route-600` | ninguno | Navegación inline. |

- Altura: 44px (default), 36px (compact), 52px (hero).
- Padding horizontal: 20px.
- Fuente: Inter 600, 14px.
- Focus: anillo 2px `route-600`, offset 2px.
- Disabled: opacidad 40%, cursor not-allowed.
- Loading: spinner 16px + texto “Guardando…” o “Calculando…”.

### 6.2 Inputs

- Altura 44px; label arriba, 14px Inter 500.
- Borde 1px `sand-300`; focus borde `route-600` + anillo 2px.
- Placeholder solo como ejemplo, nunca como label.
- Helper text 12px `ink-500`.
- Error: borde `danger-600`, mensaje 12px `danger-600` con icono.
- Textarea: min-height 96px.
- Select: chevron a la derecha, mismo estilo.
- Checkbox/toggle: 20px, acento `signal-600`.
- Campos de código: IBM Plex Mono, uppercase, letter-spacing.

### 6.3 Chips de estado

- Pill de 24px de alto, padding 0 10px.
- Punto de 6px + label 12px Inter 600.
- Colores según tabla de estados.
- No usar chips como botones; si son filtros, agregar hover y estado activo.

### 6.4 Cards

- Fondo `surface`, borde 1px `sand-300`, radio 8px, padding 24px.
- Título 16px Inter 600; cuerpo 14px.
- Acción en el header a la derecha (link o ghost).
- No anidar cards con sombras; usar divisores.

### 6.5 Tablas

- Contenedor con borde y radio 8px.
- Header sticky, fondo `paper`, texto 12px uppercase `ink-500`.
- Filas de 44px, borde inferior 1px `sand-200`.
- Hover: `sand-200` al 50%.
- Números alineados a la derecha; códigos en mono.
- Acciones en la última columna con menú de tres puntos o botón ghost.
- En móvil: cards con label/valor.

### 6.6 Timeline de tracking

- Línea vertical de 2px a la izquierda.
- Nodo de 12px: completado `ink-900`; actual `signal-600` con halo; futuro borde `sand-300` y fondo paper.
- Título del evento 14px Inter 600; timestamp 12px mono `ink-500`; descripción 14px.
- Tramo futuro: línea punteada.
- En móvil, la timeline ocupa todo el ancho y el mapa va debajo.

### 6.7 Stepper

- Círculos de 28px con número; completado `ink-900` con check; actual `signal-600`; futuro borde sand.
- Línea de conexión de 2px; completada `ink-900`, futura punteada.
- Label 12px debajo o al lado.
- En móvil: solo números y label del paso actual.

### 6.8 Mapas

- Fondo desaturado, tiles claros.
- Ruta principal: `signal-600`, 3px, con linecap round.
- Ruta completada: `ink-900`, 3px.
- Marcadores: pin circular de 12px con borde blanco; origen `ink-900`, destino `signal-600`.
- Overlay de distancia/tiempo: card blanca con borde, 12px, esquina inferior izquierda.
- Atribución OSM visible y legible.
- En mockups, usar un mapa estilizado con grilla y rutas; no hace falta un mapa real.

### 6.9 KPIs

- Label 12px uppercase `ink-500`.
- Valor 32px Archivo Bold.
- Delta 12px con icono de flecha y color semántico.
- Sparkline opcional de 32px de alto.
- Sin tarjetas de “vanity metrics”; cada KPI debe tener una acción o contexto.

### 6.10 Empty states

- Ilustración de línea de ruta (SVG simple) en `sand-300` y `signal-600`.
- Título 18px; descripción 14px; CTA primario.
- No usar personajes 3D ni fotos.

### 6.11 Modales y toasts

- Modal centrado, max-width 480px, overlay `ink-950` al 40%, radio 8px, padding 24px.
- Título 20px; descripción 14px; acciones alineadas a la derecha.
- Confirmación destructiva: botón danger + motivo obligatorio si aplica.
- Toast: esquina inferior derecha, 360px, borde izquierdo 4px semántico, duración 4s.
- `aria-live` para toasts y errores.

### 6.12 Navegación

- Público: logo a la izquierda; links al centro; acciones a la derecha.
- Cliente: sidebar con iconos Lucide 18px + label 14px; item activo con fondo `sand-200`.
- Ops: sidebar oscura; item activo `signal-600`; submenú si hace falta.
- Breadcrumbs en detalles y reportes.

---

## 7. Iconografía e ilustración

- **Iconos:** Lucide, stroke 1.5px, tamaño 16/18/20px.
- **Ilustración:** diagramas de ruta, cajas isométricas simples, etiquetas, mapas abstractos. Líneas finas, sin degradados.
- **Fotografía:** evitar stock genérico. Si se usa, solo imágenes de paquetes, mapas o texturas de papel.
- **Texturas:** papel sutil, grilla de mapa, tramas de puntos. Muy baja intensidad.

---

## 8. Movimiento

- Duración: 150–250ms para interacciones; 400–600ms para dibujo de ruta.
- Easing: `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Timeline: la línea se dibuja al entrar; el nodo actual pulsa suavemente.
- Mapa: la ruta se dibuja una vez; no animar en loop.
- Respetar `prefers-reduced-motion`; sin parallax ni autoplay.

---

## 9. Voz y tono

- **Cliente:** claro, directo, tranquilo. Sin tecnicismos.
- **Ops:** preciso, accionable. “Asignar repartidor”, “Registrar incidencia”.
- **Errores:** explicar qué pasó, por qué y qué hacer. Nunca culpar al usuario.
- **Éxito:** confirmar y decir qué sigue. “Envío creado. Ya podés seguirlo con el código EY-4F8A1C.”

Ejemplos:

- “Tu envío está en camino.”
- “Llega mañana antes de las 18.”
- “No encontramos esa dirección. Revisá calle, número y ciudad.”
- “No pudimos calcular la ruta. Reintentá o continuá con una distancia estimada.”
- “Todavía no tenés envíos. Cotizá el primero en menos de 2 minutos.”

---

## 10. Do / Don't

### Do

- Usar la ruta como motivo gráfico consistente.
- Mostrar el estado y la próxima acción en cada pantalla.
- Usar mono para códigos y timestamps.
- Mantener una sola CTA primaria por pantalla.
- Dejar respirar el contenido en público; densificar en ops.
- Usar datos realistas: EY-4F8A1C, Córdoba → Rosario, 401 km, 2 paquetes, 7.3 kg, ARS 81.700.

### Don't

- Gradientes violetas, glassmorphism, neón.
- Tarjetas redondeadas en exceso (radio > 12px).
- Sombras difusas en todas las cards.
- Fotos de stock de repartidores sonriendo.
- Iconos de colores mezclados sin sistema.
- Texto placeholder como label.
- Métricas decorativas sin acción.
- Animaciones en loop.

---

## 11. Uso en Google Stitch

1. Crear proyecto **Web** (desktop-first).
2. Pegar el **master prompt** de [`stitch-prompt.md`](./stitch-prompt.md).
3. Generar una **style tile / design system board** con la sección 12.
4. Generar las pantallas P0 en orden.
5. Para cada pantalla, usar el prompt específico y pedir consistencia con el design system.
6. Exportar screenshots/HTML y guardarlos en `docs/design/stitch/`.
7. Documentar desvíos en `docs/design/design-review.md`.

### Checklist de consistencia

- [ ] Paleta limitada a ink, paper, signal, route, mint, danger + neutros.
- [ ] Archivo/Inter/IBM Plex Mono en todos los títulos, body y códigos.
- [ ] Un solo CTA primario por pantalla.
- [ ] Chips de estado con el mismo componente.
- [ ] Timeline con línea sólida/punteada y nodo actual naranja.
- [ ] Mapas con ruta naranja y marcadores tinta.
- [ ] Cards con borde 1px y radio 8px.
- [ ] Tablas densas y legibles.
- [ ] Empty states con línea de ruta, no personajes.
- [ ] Copy en español Argentina y ARS.

---

## 12. Prompt para el design system board

```text
Create a design system board for EnvíoYa, a logistics web app. Use the "Control Tower / Wayfinding" concept: transit maps, parcel labels, operations dashboards. Show the complete system on one artboard:
- Color palette: Ink #0B1220, Paper #F6F2E9, Signal #D93A00, Route #1D4ED8, Mint #B9F27C, Sand #D8D0C0, Danger #B42318.
- Typography: Archivo (display), Inter (body), IBM Plex Mono (codes/timestamps).
- Components: primary/secondary/outline/ghost/danger buttons, inputs with labels and errors, status chips for Pendiente/En tránsito/En sucursal/En reparto/Entregado/Con incidencia/Devuelto/Cancelado, cards, data table, tracking timeline, stepper, KPI card, map with route, empty state, modal, toast.
- Style: warm paper background, 1px sand borders, 8px card radius, almost no shadows, generous whitespace, precise and human.
- No purple gradients, no glassmorphism, no 3D blobs, no stock photos.
- All labels in Spanish (Argentina). Currency ARS.
```
