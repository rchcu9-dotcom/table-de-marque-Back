import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';

import { MatchCacheService } from '@/infrastructure/persistence/match-cache.service';

@Injectable()
export class MatchPollingService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private readonly logger = new Logger(MatchPollingService.name);
  private readonly intervalMs: number;
  private readonly enabled: boolean;

  constructor(private readonly cacheService: MatchCacheService) {
    this.intervalMs = Number(process.env.MATCH_CACHE_REFRESH_MS ?? '60000');
    const envFlag = (process.env.MATCH_CACHE_POLLING_ENABLED ?? '').toLowerCase();
    const nodeEnv = (process.env.NODE_ENV ?? '').toLowerCase();
    this.enabled = envFlag ? envFlag !== 'false' : nodeEnv !== 'test';
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.log('Match cache polling disabled by configuration.');
      return;
    }

    try {
      await this.cacheService.refresh(true);
    } catch (error: any) {
      this.logger.error(`Initial match cache refresh failed: ${error?.message ?? error}`);
    }

    this.timer = setInterval(async () => {
      try {
        await this.cacheService.refresh();
      } catch (error: any) {
        this.logger.error(`Match cache refresh failed: ${error?.message ?? error}`);
      }
    }, this.intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
