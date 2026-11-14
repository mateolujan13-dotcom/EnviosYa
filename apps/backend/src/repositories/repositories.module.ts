import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { BranchesRepository } from './branches.repository';
import { ClientsRepository } from './clients.repository';
import { FleetRepository } from './fleet.repository';
import { PricingRepository } from './pricing.repository';
import { ShipmentsRepository } from './shipments.repository';
import { UsersRepository } from './users.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    ShipmentsRepository,
    BranchesRepository,
    ClientsRepository,
    FleetRepository,
    PricingRepository,
    UsersRepository,
  ],
  exports: [
    ShipmentsRepository,
    BranchesRepository,
    ClientsRepository,
    FleetRepository,
    PricingRepository,
    UsersRepository,
  ],
})
export class RepositoriesModule {}
