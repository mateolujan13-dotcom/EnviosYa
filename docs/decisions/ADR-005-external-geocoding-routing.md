# ADR-005: Integración con OpenStreetMap (Nominatim + OSRM) con Resiliencia y Caché

* **Estado:** Aprobada
* **Fecha:** 2026-11-12
* **Decisores:** Equipo de Arquitectura & Antigravity Assistant

---

## Contexto y Planteamiento del Problema (D-005)

La aplicación requiere geocodificación de direcciones argentinas (convertir calle, número y ciudad en latitud/longitud) y cálculo de distancias/rutas viales para:
1. Cotizar envíos con precisión basada en kilómetros reales recorridos (Paso 1 y 3 del Wizard).
2. Renderizar el trazado de la ruta en los mapas interactivos (Tracking público, detalle de envío y panel de operaciones).

Debemos definir el proveedor de servicios cartográficos y garantizar que la aplicación continúe funcionando aún si la API externa experimenta latencia o límites de tasa (*rate limits*).

---

## Opciones Consideradas

1. **Google Maps Platform (Geocoding API + Directions API):**
   * Alta precisión, pero requiere tarjeta de crédito, API key activa y genera costos por uso. Riesgoso para repositorios públicos o demostraciones abiertas de portfolio.
2. **OpenStreetMap público (Nominatim para geocodificación + OSRM para ruteo):**
   * Gratuito, de código abierto, no requiere API key y cuenta con excelente cobertura en rutas y ciudades de Argentina.
   * Sujeto a políticas de uso comunitarias (Nominatim: máximo 1 request/segundo).
3. **Cálculo euclidiano / fórmula de Haversine pura (sin servicios externos):**
   * No calcula curvas ni kilómetros de ruta real en ruta vial, subestimando tiempos y distancias.

---

## Decisión

Utilizar **OpenStreetMap (Nominatim + OSRM)** mediante un **Módulo Adaptador con Caché y Fallback local** en NestJS:

* **Geocodificación (`Nominatim`):**
  * `https://nominatim.openstreetmap.org/search?format=json&q=...&countrycodes=ar`
  * Header obligatorio `User-Agent: EnvioYaApp-Portfolio/1.0`.
* **Ruteo (`OSRM Routing Machine`):**
  * `http://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=geojson`
  * Retorna la distancia exacta en metros, duración estimada en segundos y los puntos geoespaciales GeoJSON para dibujar la polilínea en Leaflet / Mapbox.
* **Estrategia de Resiliencia y Fallback:**
  1. **Caché en memoria (LRU / Map en NestJS):** Direcciones y rutas entre sucursales conocidas (ej: Córdoba ↔ Rosario, Córdoba ↔ CABA) se almacenan en caché para evitar llamadas repetidas.
  2. **Coordenadas de Sucursales Preconfiguradas:** Las sucursales ya registradas en la base de datos (`SUC-CBA`, `SUC-ROS`, `SUC-BUE`, etc.) tienen sus coordenadas fijas guardadas en la colección `sucursales`.
  3. **Fallback por Haversine:** Si el servicio OSRM no responde en menos de 2.5 segundos, el servicio calcula la distancia por gran círculo (Haversine) multiplicada por un factor de corrección de ruta vial vial (factor $1.25$), asegurando que el usuario nunca quede bloqueado sin cotización.

---

## Consecuencias

### Positivas
* **Autonomía total y costo cero:** El proyecto se puede clonar y ejecutar en cualquier máquina sin necesidad de configurar tarjetas ni pagar claves de API privadas.
* **Experiencia de usuario fluida:** Mapas visuales con rutas reales y estimaciones de tiempo fiables.
* **Alta tolerancia a fallos:** El sistema sigue operando incluso sin conexión a Internet gracias al fallback de distancia.
