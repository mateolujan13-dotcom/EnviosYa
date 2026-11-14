import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../repositories/repositories.module';
import { PricingModule } from '../pricing/pricing.module';
import { GeoModule } from '../geo/geo.module';
import { ShipmentsTrackingController } from './shipments-tracking.controller';
import { ShipmentsTrackingService } from './shipments-tracking.service';
import { TrackRateLimitGuard } from './track-rate-limit.guard';
import { ClientShipmentsController } from './client-shipments.controller';
import { ClientShipmentsService } from './client-shipments.service';

@Module({
  imports: [RepositoriesModule, PricingModule, GeoModule],
  controllers: [ShipmentsTrackingController, ClientShipmentsController],
  providers: [ShipmentsTrackingService, TrackRateLimitGuard, ClientShipmentsService],
})
export class ShipmentsModule {}
