import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { EventBucketService } from './event-bucket.service';
import { OpsController } from './ops.controller';
import { OpsService } from './ops.service';

@Module({
  imports: [DatabaseModule, RepositoriesModule],
  controllers: [OpsController],
  providers: [OpsService, EventBucketService],
  exports: [OpsService],
})
export class OpsModule {}
