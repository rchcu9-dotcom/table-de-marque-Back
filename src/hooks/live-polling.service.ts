import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { LiveCacheService } from '@/infrastructure/http/live/live-cache.service';

@Injectable()
export class LivePollingService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private readonly logger = new Logger(LivePollingService.name);
  private readonly intervalMs = Number(
    process.env.LIVE_POLLING_INTERVAL_MS ?? '30000',
  );
  private readonly enabled: boolean;

  constructor(private readonly cacheService: LiveCacheService) {
    const envFlag = (process.env.LIVE_POLLING_ENABLED ?? '').toLowerCase();
    const nodeEnv = (process.env.NODE_ENV ?? '').toLowerCase();
    this.enabled = envFlag ? envFlag !== 'false' : nodeEnv !== 'test';
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.log('Live polling disabled by configuration.');
      return;
    }

    try {
      await this.cacheService.refresh(true);
    } catch (error: unknown) {
      this.logger.error(
        `Initial live refresh failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    this.timer = setInterval(() => {
      void this.cacheService.refresh().catch((error: unknown) => {
        this.logger.error(
          `Live refresh failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
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
