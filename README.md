# EnvíoYa App

Aplicación web de logística y paquetería construida sobre el diseño de base de datos MongoDB del TP9. Incluye un portal de clientes y un back-office operativo.

> **Estado:** diseño de producto (PRD, flujos, wireframes y sistema de diseño). Todavía no hay implementación.
> **Stack decidido:** NestJS + React + MongoDB.
> **Base de datos:** `envioya` (TP9), reutilizada con el esquema existente + colección `usuarios`.

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
- Se reutiliza el esquema del TP9 (`clientes`, `envios`, `eventos_seguimiento`, etc.) y se agrega `usuarios`.
- Los envíos usan IDs string (`ENV-YYYY-####`) y códigos `EY-XXXXXX`.
- La baja de un envío es **lógica** (`cancelado`), nunca física.
- La identidad visual se explora con Google Stitch a partir del PRD y `DESIGN.md`.

---

## Próximos pasos

1. Revisar el PRD y los wireframes.
2. Generar la identidad visual en Stitch y aprobar una dirección.
3. Diseñar la arquitectura técnica y los ADRs.
4. Escribir el plan de implementación por fases.
5. Crear el repositorio GitHub y comenzar el desarrollo.

---

## Estructura del repositorio (prevista)

```text
envioya-app/
├── apps/
│   ├── api/          # NestJS
│   └── web/          # React + Vite
├── packages/
│   └── shared/       # Tipos, schemas y contratos
├── docs/
│   ├── product/      # PRD, diseño, flujos, wireframes, prompts
│   ├── architecture/ # Diagramas y ADRs (próximo)
│   └── decisions/    # Decision log
├── scripts/          # Seeds, migraciones y utilidades
└── README.md
```

> La estructura de código se confirmará en la etapa de arquitectura.
