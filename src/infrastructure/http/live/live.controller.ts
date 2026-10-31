import { Controller, Get } from '@nestjs/common';
import { Public } from '@/auth/decorators/public.decorator';

import { LiveCacheService } from './live-cache.service';
import { LiveStatusResponse } from './live.types';

@Controller('live')
@Public()
export class LiveController {
  constructor(private readonly liveCacheService: LiveCacheService) {}

  @Get('status')
  async getStatus(): Promise<LiveStatusResponse> {
    return this.liveCacheService.getStatus();
  }
}
