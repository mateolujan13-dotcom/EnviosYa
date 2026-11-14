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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ClientShipmentsService } from './client-shipments.service';
import {
  CancelShipmentDto,
  CreateShipmentDto,
  ShipmentsQueryDto,
} from './dto/create-shipment.dto';

const SHIPMENT_CODE_PATTERN = /^EY-[A-Z0-9]{6}$/;

@Controller('shipments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.CLIENTE)
export class ClientShipmentsController {
  constructor(private readonly shipments: ClientShipmentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() usuario: AuthenticatedUser,
    @Body() dto: CreateShipmentDto,
  ) {
    return this.shipments.create(usuario, dto);
  }

  @Get()
  list(
    @CurrentUser() usuario: AuthenticatedUser,
    @Query() query: ShipmentsQueryDto,
  ) {
    return this.shipments.list(usuario, query);
  }

  @Get('summary')
  summary(@CurrentUser() usuario: AuthenticatedUser) {
    return this.shipments.summary(usuario);
  }

  @Get(':codigo')
  detail(
    @CurrentUser() usuario: AuthenticatedUser,
    @Param('codigo') codigo: string,
  ) {
    assertCodigo(codigo);
    return this.shipments.detail(usuario, codigo);
  }

  @Post(':codigo/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() usuario: AuthenticatedUser,
    @Param('codigo') codigo: string,
    @Body() dto: CancelShipmentDto,
  ) {
    assertCodigo(codigo);
    return this.shipments.cancel(usuario, codigo, dto);
  }
}

function assertCodigo(codigo: string): void {
  if (!SHIPMENT_CODE_PATTERN.test(codigo)) {
    throw new BadRequestException('Código de envío inválido');
  }
}
