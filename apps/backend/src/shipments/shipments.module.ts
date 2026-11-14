import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../repositories/repositories.module';
import { ShipmentsTrackingController } from './shipments-tracking.controller';
import { ShipmentsTrackingService } from './shipments-tracking.service';
import { TrackRateLimitGuard } from './track-rate-limit.guard';

@Module({
  imports: [RepositoriesModule],
  controllers: [ShipmentsTrackingController],
  providers: [ShipmentsTrackingService, TrackRateLimitGuard],
})
export class ShipmentsModule {}
