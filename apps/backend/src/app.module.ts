import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { RepositoriesModule } from './repositories/repositories.module';
import { ShipmentsModule } from './shipments/shipments.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    RepositoriesModule,
    AuthModule,
    ShipmentsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
