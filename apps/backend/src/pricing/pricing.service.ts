import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CotizacionResultadoDto } from '@envioya/shared';
import { GeoService } from '../geo/geo.service';
import { PricingRepository } from '../repositories/pricing.repository';
import { QuoteRequestDto } from './dto/quote.dto';

@Injectable()
export class PricingService {
  constructor(
    private readonly pricing: PricingRepository,
    private readonly geo: GeoService,
  ) {}

  /**
   * Cotización polinómica (P-004): tarifa base + distancia + peso
   * + adicional frágil (si hay ≥1 bulto frágil, una vez) + seguro
   * sobre el valor declarado. Desglose en 2 decimales; IVA sobre subtotal.
   */
  async quote(input: QuoteRequestDto): Promise<CotizacionResultadoDto> {
    const tarifa = await this.pricing.findActiva();

    if (!tarifa) {
      throw new ServiceUnavailableException('No hay tarifa vigente');
    }

    const [origen, destino] = await Promise.all([
      this.geo.geocodeAddress(input.origen),
      this.geo.geocodeAddress(input.destino),
    ]);

    const route = await this.geo.getDrivingRoute(origen, destino);

    const pesoTotalKg = round2(
      input.paquetes.reduce((sum, paquete) => sum + paquete.pesoKg, 0),
    );
    const volumenTotalM3 = round4(
      input.paquetes.reduce(
        (sum, paquete) =>
          sum +
          (paquete.dimensiones.altoCm *
            paquete.dimensiones.anchoCm *
            paquete.dimensiones.profundoCm) /
            1_000_000,
        0,
      ),
    );
    const valorDeclarado = input.paquetes.reduce((sum, paquete) => {
      const declared = readValorDeclarado(paquete.caracteristicas);
      return sum + (declared ?? 0);
    }, 0);
    const hayFragil = input.paquetes.some((paquete) => paquete.fragil);

    const precioBase = round2(tarifa.precioBase);
    const adicionalDistancia = round2(route.distanciaKm * tarifa.precioKm);
    const adicionalPeso = round2(pesoTotalKg * tarifa.precioKg);
    const flete = precioBase + adicionalDistancia + adicionalPeso;

    const adicionalFragil = hayFragil
      ? round2((flete * tarifa.recargoFragilPorcentaje) / 100)
      : 0;
    const seguro = round2((valorDeclarado * tarifa.tasaSeguroPorcentaje) / 100);

    const subtotal = round2(flete + adicionalFragil + seguro);
    const iva = round2((subtotal * tarifa.alicuotaIva) / 100);
    const total = round2(subtotal + iva);

    return {
      distanciaKm: round2(route.distanciaKm),
      duracionEstimadaHoras: round2(route.duracionEstimadaHoras),
      pesoTotalKg,
      volumenTotalM3,
      desglose: {
        precioBase,
        adicionalDistancia,
        adicionalPeso,
        adicionalFragil,
        seguro,
        subtotal,
        iva,
        total,
      },
      moneda: tarifa.moneda,
      distanciaEstimada: route.distanciaEstimada,
    };
  }
}

function readValorDeclarado(
  caracteristicas?: Array<{ k: string; v: string | number | boolean }>,
): number | null {
  if (!caracteristicas) {
    return null;
  }

  for (const caracteristica of caracteristicas) {
    if (caracteristica.k !== 'valorDeclarado') {
      continue;
    }

    const value =
      typeof caracteristica.v === 'number'
        ? caracteristica.v
        : typeof caracteristica.v === 'string'
          ? Number(caracteristica.v)
          : Number.NaN;

    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return null;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}
