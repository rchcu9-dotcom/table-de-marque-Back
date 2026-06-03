import { Controller, Get } from '@nestjs/common';
import { HealthService, HealthPayload } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async check(): Promise<HealthPayload> {
    return this.healthService.check();
  }
}
