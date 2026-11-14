import {
  BadRequestException,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { IDireccion } from '@envioya/shared';
import { Coordinates, haversineKm } from './haversine';
import { TtlCache } from './ttl-cache';

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{ ok: boolean; status?: number; json(): Promise<unknown> }>;

export interface DrivingRoute {
  distanciaKm: number;
  duracionEstimadaHoras: number;
  /** true cuando la distancia proviene del fallback Haversine × 1.25. */
  distanciaEstimada: boolean;
}

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const OSRM_ENDPOINT = 'http://router.project-osrm.org/route/v1/driving';
const USER_AGENT = 'EnvioYaApp-Portfolio/1.0';
const GEOCODE_TIMEOUT_MS = 4000;
const ROUTE_TIMEOUT_MS = 2500;
const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ROUTE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

/** Corrección de ruteo vial acordada en ADR-005 para el fallback Haversine. */
export const HAVERSINE_ROUTE_FACTOR = 1.25;
/** Velocidad media estimada para duraciones sin OSRM. */
export const ASSUMED_SPEED_KMH = 80;

@Injectable()
export class GeoService {
  private readonly geocodeCache = new TtlCache<Coordinates>(
    MAX_CACHE_ENTRIES,
    GEOCODE_CACHE_TTL_MS,
  );

  private readonly routeCache = new TtlCache<DrivingRoute>(
    MAX_CACHE_ENTRIES,
    ROUTE_CACHE_TTL_MS,
  );

  constructor(
    @Optional()
    private readonly fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
  ) {}

  /**
   * Geocodifica una dirección argentina vía Nominatim.
   * - Sin resultados → 400 (dirección no encontrada).
   * - Servicio caído / timeout / status inesperado → 503.
   */
  async geocodeAddress(direccion: IDireccion): Promise<Coordinates> {
    const query = formatAddress(direccion);
    const cached = this.geocodeCache.get(query);

    if (cached) {
      return cached;
    }

    const url = `${NOMINATIM_ENDPOINT}?format=json&q=${encodeURIComponent(
      query,
    )}&countrycodes=ar&limit=1`;

    let data: unknown;
    try {
      const response = await this.fetchImpl(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`nominatim status ${response.status}`);
      }

      data = await response.json();
    } catch {
      throw new ServiceUnavailableException(
        'No pudimos geocodificar la dirección (servicio de mapas no disponible)',
      );
    }

    const hit = Array.isArray(data) ? (data[0] as { lat: string; lon: string } | undefined) : undefined;

    if (!hit) {
      throw new BadRequestException(`No encontramos la dirección: ${query}`);
    }

    const coordinates = { lat: Number(hit.lat), lng: Number(hit.lon) };

    if (Number.isNaN(coordinates.lat) || Number.isNaN(coordinates.lng)) {
      throw new BadRequestException(`No encontramos la dirección: ${query}`);
    }

    this.geocodeCache.set(query, coordinates);
    return coordinates;
  }

  /**
   * Distancia/duración entre dos puntos. Intenta OSRM (≤2.5 s); si falla,
   * degrada a Haversine × 1.25 con `distanciaEstimada: true` (ADR-005).
   * Nunca lanza por fallos de red: el fallback garantiza cotización.
   */
  async getDrivingRoute(from: Coordinates, to: Coordinates): Promise<DrivingRoute> {
    const key = [from, to]
      .map((point) => `${point.lat.toFixed(3)},${point.lng.toFixed(3)}`)
      .join('->');

    const cached = this.routeCache.get(key);

    if (cached) {
      return cached;
    }

    let route: DrivingRoute;
    try {
      route = await this.fetchOsrmRoute(from, to);
    } catch {
      route = haversineRoute(from, to);
    }

    this.routeCache.set(key, route);
    return route;
  }

  private async fetchOsrmRoute(from: Coordinates, to: Coordinates): Promise<DrivingRoute> {
    const url = `${OSRM_ENDPOINT}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;

    const response = await this.fetchImpl(url, {
      signal: AbortSignal.timeout(ROUTE_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`osrm status ${response.status}`);
    }

    const data = (await response.json()) as {
      routes?: Array<{ distance?: number; duration?: number }>;
    };

    const route = data?.routes?.[0];

    if (
      !route ||
      typeof route.distance !== 'number' ||
      typeof route.duration !== 'number'
    ) {
      throw new Error('osrm: ruta inválida');
    }

    return {
      distanciaKm: route.distance / 1000,
      duracionEstimadaHoras: route.duration / 3600,
      distanciaEstimada: false,
    };
  }
}

function haversineRoute(from: Coordinates, to: Coordinates): DrivingRoute {
  const distanciaKm = haversineKm(from, to) * HAVERSINE_ROUTE_FACTOR;

  return {
    distanciaKm,
    duracionEstimadaHoras: distanciaKm / ASSUMED_SPEED_KMH,
    distanciaEstimada: true,
  };
}

function formatAddress(direccion: IDireccion): string {
  return `${direccion.calle} ${direccion.numero}, ${direccion.ciudad}, ${direccion.provincia}`
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
