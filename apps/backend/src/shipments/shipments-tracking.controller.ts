import { PublicTrackingDto } from '@envioya/shared';
import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Param,
  UseGuards,
} from '@nestjs/common';
import { TrackRateLimitGuard } from './track-rate-limit.guard';
import { ShipmentsTrackingService } from './shipments-tracking.service';
import { TRACKING_INVALID_CODE_MESSAGE } from './tracking.constants';

const TRACKING_CODE_PATTERN = /^EY-[A-Z0-9]{6}$/;

@Controller('shipments')
export class ShipmentsTrackingController {
  constructor(private readonly tracking: ShipmentsTrackingService) {}

  @Get('track/:code')
  @UseGuards(TrackRateLimitGuard)
  @Header('Cache-Control', 'public, max-age=60')
  trackByCode(@Param('code') code: string): Promise<PublicTrackingDto> {
    if (!TRACKING_CODE_PATTERN.test(code)) {
      throw new BadRequestException(TRACKING_INVALID_CODE_MESSAGE);
    }

    return this.tracking.trackByCode(code);
  }
}
