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
  private readonly quotaCooldownMs = Number(
    process.env.LIVE_QUOTA_COOLDOWN_MS ?? '300000',
  );
  private readonly fallbackThreshold = Math.max(
    1,
    Number(process.env.LIVE_FALLBACK_STREAK_THRESHOLD ?? '2'),
  );

  private cache: LiveStatusResponse | null = null;
  private lastHash?: string;
  private refreshPromise?: Promise<LiveStatusResponse>;
  private quotaCooldownUntilMs = 0;
  private lastWasForced = false;
  private fallbackStreak = 0;

  constructor(
    private readonly detectionService: LiveDetectionService,
    @Optional()
    private readonly stream?: LiveStreamService,
  ) {}

  async getStatus(): Promise<LiveStatusResponse> {
    const forcedVideoId = this.getForcedVideoId();
    if (forcedVideoId) {
      if (
        !this.cache ||
        !this.lastWasForced ||
        this.cache.mode !== 'live' ||
        this.cache.liveVideoId !== forcedVideoId
      ) {
        return this.refresh(true);
      }
    } else if (this.lastWasForced) {
      return this.refresh(true);
    }

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
    const nowMs = Date.now();
    const forcedVideoId = this.getForcedVideoId();

    let detection: LiveDetectionResult;
    if (forcedVideoId) {
      this.lastWasForced = true;
      this.quotaCooldownUntilMs = 0;
      detection = {
        isLive: true,
        liveVideoId: forcedVideoId,
        sourceState: 'ok',
      };
    } else if (
      !force &&
      this.quotaCooldownUntilMs > nowMs &&
      this.cache &&
      this.cache.sourceState === 'quota_exceeded'
    ) {
      this.lastWasForced = false;
      detection = {
        isLive: false,
        liveVideoId: null,
        sourceState: 'quota_exceeded',
      };
    } else {
      this.lastWasForced = false;
      detection = await this.detectionService.detectLive();
      if (detection.sourceState === 'quota_exceeded') {
        this.quotaCooldownUntilMs = nowMs + this.quotaCooldownMs;
      } else if (detection.sourceState === 'ok') {
        this.quotaCooldownUntilMs = 0;
      }
    }

    const nextStatus = this.buildStatus(detection, nowMs);
    const stableStatus = this.applyAntiFlap(nextStatus, detection);
    const nextHash = this.hashStatus(stableStatus);
    const changed = force || this.lastHash !== nextHash;

    this.cache = stableStatus;
    this.lastHash = nextHash;

    if (changed && this.stream) {
      this.stream.emit({
        type: 'live_status',
        status: stableStatus,
        version: nextHash,
        timestamp: Date.now(),
      });
    }

    return stableStatus;
  }

  private applyAntiFlap(
    nextStatus: LiveStatusResponse,
    detection: LiveDetectionResult,
  ): LiveStatusResponse {
    if (nextStatus.isLive) {
      this.fallbackStreak = 0;
      return nextStatus;
    }

    const currentlyLive =
      Boolean(this.cache?.isLive) &&
      Boolean(this.cache?.liveVideoId) &&
      Boolean(this.cache?.liveEmbedUrl);
    if (!currentlyLive) {
      this.fallbackStreak = 0;
      return nextStatus;
    }

    this.fallbackStreak += 1;
    this.logger.debug(
      `Live detection: fallback streak: ${this.fallbackStreak}/${this.fallbackThreshold}`,
    );

    if (this.fallbackStreak < this.fallbackThreshold) {
      this.logger.debug('Live detection: state kept live due to anti-flap');
      return {
        ...this.cache!,
        updatedAt: new Date().toISOString(),
        sourceState: detection.sourceState,
      };
    }

    this.fallbackStreak = 0;
    return nextStatus;
  }

  private buildStatus(
    detection: LiveDetectionResult,
    nowMs: number,
  ): LiveStatusResponse {
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
      nextRefreshInSec: this.getNextRefreshInSec(nowMs),
      sourceState,
    };
  }

  private getForcedVideoId(): string | null {
    const enabled =
      (process.env.LIVE_FORCE_ENABLED ?? 'false').toLowerCase() === 'true';
    const id = (process.env.LIVE_FORCE_VIDEO_ID ?? '').trim();
    if (!enabled || !id) return null;
    return id;
  }

  private getNextRefreshInSec(nowMs: number): number {
    if (this.quotaCooldownUntilMs > nowMs) {
      return Math.max(1, Math.ceil((this.quotaCooldownUntilMs - nowMs) / 1000));
    }
    return Math.max(1, Math.floor(this.pollingIntervalMs / 1000));
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
