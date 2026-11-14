import { RolUsuario } from '@envioya/shared';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  AssignResourcesDto,
  IncidentDto,
  OpsShipmentsQueryDto,
  ResolveIncidentDto,
} from './dto/ops.dto';
import { OpsService } from './ops.service';

const SHIPMENT_CODE_PATTERN = /^EY-[A-Z0-9]{6}$/;

@Controller('ops')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.OPERADOR, RolUsuario.ADMIN)
export class OpsController {
  constructor(private readonly ops: OpsService) {}

  @Get('shipments')
  list(@Query() query: OpsShipmentsQueryDto) {
    return this.ops.list(query);
  }

  // S5 (spec): GET /api/ops/shipments/summary — declarado antes de :codigo.
  @Get('shipments/summary')
  summary() {
    return this.ops.summary();
  }

  // Alias del handoff: GET /api/ops/summary.
  @Get('summary')
  summaryAlias() {
    return this.ops.summary();
  }

  @Get('shipments/:codigo')
  detail(@Param('codigo') codigo: string) {
    assertCodigo(codigo);
    return this.ops.detail(codigo);
  }

  @Post('shipments/:codigo/assign')
  @HttpCode(HttpStatus.OK)
  assign(@Param('codigo') codigo: string, @Body() dto: AssignResourcesDto) {
    assertCodigo(codigo);
    return this.ops.assign(codigo, dto);
  }

  @Post('shipments/:codigo/dispatch')
  @HttpCode(HttpStatus.OK)
  dispatch(@Param('codigo') codigo: string) {
    assertCodigo(codigo);
    return this.ops.dispatch(codigo);
  }

  @Post('shipments/:codigo/arrive')
  @HttpCode(HttpStatus.OK)
  arrive(@Param('codigo') codigo: string) {
    assertCodigo(codigo);
    return this.ops.arrive(codigo);
  }

  @Post('shipments/:codigo/deliver')
  @HttpCode(HttpStatus.OK)
  deliver(@Param('codigo') codigo: string) {
    assertCodigo(codigo);
    return this.ops.deliver(codigo);
  }

  @Post('shipments/:codigo/incident')
  @HttpCode(HttpStatus.OK)
  incident(@Param('codigo') codigo: string, @Body() dto: IncidentDto) {
    assertCodigo(codigo);
    return this.ops.incident(codigo, dto);
  }

  @Post('shipments/:codigo/resolve-incident')
  @HttpCode(HttpStatus.OK)
  resolveIncident(
    @Param('codigo') codigo: string,
    @Body() dto: ResolveIncidentDto,
  ) {
    assertCodigo(codigo);
    return this.ops.resolveIncident(codigo, dto);
  }
}

function assertCodigo(codigo: string): void {
  if (!SHIPMENT_CODE_PATTERN.test(codigo)) {
    throw new BadRequestException('Código de envío inválido');
  }
}
