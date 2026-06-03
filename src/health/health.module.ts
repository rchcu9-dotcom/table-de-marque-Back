import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PersistenceModule } from '@/infrastructure/persistence/persistence.module';

@Module({
  imports: [PersistenceModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
