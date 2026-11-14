import { Module } from '@nestjs/common';
import { GeoModule } from '../geo/geo.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';

@Module({
  imports: [GeoModule, RepositoriesModule],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
