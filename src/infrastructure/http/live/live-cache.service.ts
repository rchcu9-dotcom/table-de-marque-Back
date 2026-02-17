import { Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';

import { LiveStreamService } from '@/hooks/live-stream.service';
import {
  LiveDetectionResult,
  LiveSourceState,
  LiveStatusResponse,
} from './live.types';
import { LiveDetectionService } from './live-detection.service';

@Injectable()
export class LiveCacheService {
  private readonly logger = new Logger(LiveCacheService.name);
  private readonly ttlMs = Number(process.env.LIVE_CACHE_TTL_MS ?? '60000');
  private readonly fallbackVideoId =
    process.env.LIVE_FALLBACK_VIDEO_ID ?? 'at3v7WepbDg';
  private readonly pollingIntervalMs = Number(
    process.env.LIVE_POLLING_INTERVAL_MS ?? '30000',
  );

  private cache: LiveStatusResponse | null = null;
  private lastHash?: string;
  private refreshPromise?: Promise<LiveStatusResponse>;

  constructor(
    private readonly detectionService: LiveDetectionService,
    @Optional()
    private readonly stream?: LiveStreamService,
  ) {}

  async getStatus(): Promise<LiveStatusResponse> {
    if (!this.cache) {
      return this.refresh(true);
    }

    const updatedAtMs = new Date(this.cache.updatedAt).getTime();
    const isStale = Date.now() - updatedAtMs > this.ttlMs;
    if (isStale) {
      void this.refresh().catch((error: unknown) => {
        this.logger.warn(
          `Background live refresh failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    }
    return this.cache;
  }

  async refresh(force = false): Promise<LiveStatusResponse> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.performRefresh(force).finally(() => {
      this.refreshPromise = undefined;
    });
    return this.refreshPromise;
  }

  private async performRefresh(force: boolean): Promise<LiveStatusResponse> {
    const detection = await this.detectionService.detectLive();
    const nextStatus = this.buildStatus(detection);
    const nextHash = this.hashStatus(nextStatus);
    const changed = force || this.lastHash !== nextHash;

    this.cache = nextStatus;
    this.lastHash = nextHash;

    if (changed && this.stream) {
      this.stream.emit({
        type: 'live_status',
        status: nextStatus,
        version: nextHash,
        timestamp: Date.now(),
      });
    }

    return nextStatus;
  }

  private buildStatus(detection: LiveDetectionResult): LiveStatusResponse {
    const liveVideoId = detection.isLive ? detection.liveVideoId : null;
    const liveEmbedUrl = liveVideoId
      ? this.buildLiveEmbedUrl(liveVideoId)
      : null;

    const sourceState: LiveSourceState = detection.sourceState;
    const isLive = sourceState === 'ok' && Boolean(liveVideoId);
    const mode = isLive ? 'live' : 'fallback';

    return {
      isLive,
      mode,
      channelUrl: this.detectionService.getChannelUrl(),
      liveVideoId: isLive ? liveVideoId : null,
      liveEmbedUrl: isLive ? liveEmbedUrl : null,
      fallbackVideoId: this.fallbackVideoId,
      fallbackEmbedUrl: this.buildFallbackEmbedUrl(this.fallbackVideoId),
      updatedAt: new Date().toISOString(),
      nextRefreshInSec: Math.max(1, Math.floor(this.pollingIntervalMs / 1000)),
      sourceState,
    };
  }

  private buildLiveEmbedUrl(videoId: string): string {
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1`;
  }

  private buildFallbackEmbedUrl(videoId: string): string {
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&playsinline=1`;
  }

  private hashStatus(status: LiveStatusResponse): string {
    const stable = {
      isLive: status.isLive,
      mode: status.mode,
      channelUrl: status.channelUrl,
      liveVideoId: status.liveVideoId,
      liveEmbedUrl: status.liveEmbedUrl,
      fallbackVideoId: status.fallbackVideoId,
      fallbackEmbedUrl: status.fallbackEmbedUrl,
      sourceState: status.sourceState,
    };
    return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
  }
}
