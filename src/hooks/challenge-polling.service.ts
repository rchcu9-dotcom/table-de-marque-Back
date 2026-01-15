import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { ChallengeCacheService } from '@/infrastructure/persistence/challenge-cache.service';

@Injectable()
export class ChallengePollingService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private readonly logger = new Logger(ChallengePollingService.name);
  private readonly intervalMs: number;
  private readonly enabled: boolean;

  constructor(private readonly cacheService: ChallengeCacheService) {
    this.intervalMs = Number(process.env.CHALLENGE_CACHE_REFRESH_MS ?? '30000');
    const envFlag = (
      process.env.CHALLENGE_CACHE_POLLING_ENABLED ?? ''
    ).toLowerCase();
    const nodeEnv = (process.env.NODE_ENV ?? '').toLowerCase();
    this.enabled = envFlag ? envFlag !== 'false' : nodeEnv !== 'test';
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.log('Challenge cache polling disabled by configuration.');
      return;
    }

    try {
      await this.cacheService.refresh(true);
    } catch (error: unknown) {
      this.logger.error(
        `Initial challenge cache refresh failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    this.timer = setInterval(() => {
      void this.cacheService.refresh().catch((error: unknown) => {
        this.logger.error(
          `Challenge cache refresh failed: ${
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
