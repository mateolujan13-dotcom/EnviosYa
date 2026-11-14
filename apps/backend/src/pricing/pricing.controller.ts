import { RolUsuario, CotizacionResultadoDto } from '@envioya/shared';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { QuoteRequestDto } from './dto/quote.dto';
import { PricingService } from './pricing.service';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Post('quote')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.CLIENTE, RolUsuario.OPERADOR, RolUsuario.ADMIN)
  quote(@Body() body: QuoteRequestDto): Promise<CotizacionResultadoDto> {
    return this.pricing.quote(body);
  }
}
