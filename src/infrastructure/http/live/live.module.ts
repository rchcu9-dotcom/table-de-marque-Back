import { Module } from '@nestjs/common';

import { LiveController } from './live.controller';
import { LiveStreamController } from './live.stream.controller';
import { LiveDetectionService } from './live-detection.service';
import { LiveCacheService } from './live-cache.service';
import { LiveStreamService } from '@/hooks/live-stream.service';
import { LivePollingService } from '@/hooks/live-polling.service';

@Module({
  controllers: [LiveController, LiveStreamController],
  providers: [
    LiveDetectionService,
    LiveCacheService,
    LiveStreamService,
    LivePollingService,
  ],
})
export class LiveModule {}
