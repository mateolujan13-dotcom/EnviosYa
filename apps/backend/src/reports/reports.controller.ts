import { RolUsuario } from '@envioya/shared';
import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ReportFiltersDto } from './dto/reports.dto';
import { ReportsService } from './reports.service';

@Controller('ops/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.OPERADOR, RolUsuario.ADMIN)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('resumen')
  resumen(@Query() query: ReportFiltersDto) {
    return this.reports.resumen(query);
  }

  @Get('por-sucursal')
  porSucursal(@Query() query: ReportFiltersDto) {
    return this.reports.porSucursal(query);
  }

  @Get('tiempos-promedio')
  tiemposPromedio(@Query() query: ReportFiltersDto) {
    return this.reports.tiemposPromedio(query);
  }

  @Get('top-repartidores')
  topRepartidores(@Query() query: ReportFiltersDto) {
    return this.reports.topRepartidores(query);
  }

  @Get('por-estado')
  porEstado(@Query() query: ReportFiltersDto) {
    return this.reports.porEstado(query);
  }

  // Ruta explícita (sin :param): el ValidationPipe global no interfiere;
  // solo aplica ReportFiltersDto (from/to/sucursalId). Streaming RFC 4180.
  @Get('envios.csv')
  enviosCsv(@Query() query: ReportFiltersDto, @Res() res: Response) {
    return this.reports.streamEnviosCsv(query, res);
  }
}
