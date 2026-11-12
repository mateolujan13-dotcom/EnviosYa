# ADR-001: Estructura de Monorepo con Workspaces y Paquete Compartido

* **Estado:** Aprobada
* **Fecha:** 2026-11-12
* **Decisores:** Equipo de Arquitectura & Antigravity Assistant

---

## Contexto y Planteamiento del Problema

El proyecto **EnvíoYa App** consta de un backend en NestJS, una aplicación web SPA en React y una base de datos documental existente en MongoDB. 

Existen múltiples entidades de dominio críticas compartidas entre ambas aplicaciones:
* Enums de estados de envío (`pendiente`, `en_transito`, `en_sucursal`, `en_reparto`, `entregado`, `con_incidencia`, `cancelado`).
* Roles de usuario (`cliente`, `operador`, `admin`).
* Tipos de eventos de trazabilidad, estructura de paquetes y fórmulas de cotización.
* DTOs de entrada y salida para solicitudes HTTP (cotización, creación de envíos, asignación).

Mantener repositorios separados o duplicar tipos en TypeScript provocaría divergencias, errores en tiempo de ejecución y doble esfuerzo en refactorizaciones.

---

## Opciones Consideradas

1. **Monorepo con workspaces nativos (`npm` o `pnpm`) y paquete `@envioya/shared`:**
   * Un único repositorio con `apps/backend`, `apps/frontend` y `packages/shared`.
   * Los tipos TypeScript se compilan o se referencian directamente mediante project references o symlinks del workspace.
2. **Repositorios independientes (`multirepo`):**
   * Un repo para backend y otro para frontend. Tipos compartidos vía paquete privado de npm o duplicados manualmente.
3. **Monolito acoplado con SSR (Next.js):**
   * Un solo framework full-stack. Descartado según decisión previa D-003 para evidenciar claramente las capas y la API REST desacoplada.

---

## Decisión

Adoptar una estructura de **Monorepo** basada en **workspaces**:

* **Gestor:** `npm` (compatible nativamente con Node.js estándar sin requerir dependencias globales adicionales en cualquier entorno de clonación/CI).
* **Organización:**
  * `apps/backend`: Aplicación NestJS.
  * `apps/frontend`: Aplicación React + Vite + Tailwind CSS.
  * `packages/shared`: Biblioteca de TypeScript sin dependencias pesadas de runtime, exportando tipos, contratos de API, esquemas de validación y constantes de dominio.
* Los scripts raíz permitirán ejecutar concurrentemente backend y frontend para desarrollo local (`npm run dev`).

---

## Consecuencias

### Positivas
* **Contratos tipo-seguros de extremo a extremo:** Cualquier cambio en la definición de un paquete o estado del envío actualiza inmediatamente los errores de compilación tanto en el backend como en los componentes de React.
* **Un único pipeline de versionado e historial:** Commits atómicos que actualizan una funcionalidad completa (ej: endpoint de asignación y pantalla de back-office en el mismo commit).
* **Fácil despliegue:** Scripts unificados para pruebas y linting.

### Negativas / Mitigaciones
* *Configuración inicial de TypeScript:* Requiere paths o referencias cruzadas cuidadosas (`tsconfig.base.json`). Se solucionará mediante un build ligero del paquete `@envioya/shared` y alias bien configurados en Vite y NestJS.
