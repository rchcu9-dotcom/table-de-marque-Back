import { Injectable, Logger } from '@nestjs/common';

import { LiveDetectionResult, LiveSourceState } from './live.types';

type YoutubeApiErrorResponse = {
  error?: {
    errors?: Array<{ reason?: string }>;
    message?: string;
  };
};

type YoutubeVideoResponse = YoutubeApiErrorResponse & {
  items?: Array<{
    id?: string;
    snippet?: {
      liveBroadcastContent?: string;
    };
    liveStreamingDetails?: {
      actualStartTime?: string;
      actualEndTime?: string;
    };
  }>;
};

@Injectable()
export class LiveDetectionService {
  private readonly logger = new Logger(LiveDetectionService.name);
  private readonly apiKey = process.env.YOUTUBE_API_KEY ?? '';
  private readonly apiTimeoutMs = Number(
    process.env.LIVE_DETECTION_TIMEOUT_MS ?? '3000',
  );
  private readonly liveUrlTimeoutMs = Number(
    process.env.LIVE_LIVEURL_TIMEOUT_MS ?? '3000',
  );
  private readonly channelIdEnv = process.env.YOUTUBE_CHANNEL_ID ?? '';
  private readonly channelHandle =
    process.env.YOUTUBE_CHANNEL_HANDLE ?? '@titouankerogues2051';

  async detectLive(): Promise<LiveDetectionResult> {
    const liveUrlVideoId = await this.resolveLiveVideoIdFromChannelUrl();
    if (!liveUrlVideoId) {
      return { isLive: false, liveVideoId: null, sourceState: 'ok' };
    }

    if (!this.apiKey) {
      return {
        isLive: false,
        liveVideoId: null,
        sourceState: 'detection_error',
      };
    }

    const validation = await this.validateLiveVideo(liveUrlVideoId);
    if (!validation.ok) {
      return {
        isLive: false,
        liveVideoId: null,
        sourceState: validation.sourceState,
      };
    }

    if (!validation.isLive) {
      return { isLive: false, liveVideoId: null, sourceState: 'ok' };
    }

    return { isLive: true, liveVideoId: liveUrlVideoId, sourceState: 'ok' };
  }

  getChannelUrl(): string {
    if (this.channelHandle) {
      const normalized = this.channelHandle.startsWith('@')
        ? this.channelHandle
        : `@${this.channelHandle}`;
      return `https://www.youtube.com/${normalized}`;
    }
    if (this.channelIdEnv) {
      return `https://www.youtube.com/channel/${this.channelIdEnv}`;
    }
    return 'https://www.youtube.com/@titouankerogues2051';
  }

  private getChannelLiveUrl(): string {
    if (this.channelIdEnv) {
      return `https://www.youtube.com/channel/${this.channelIdEnv}/live`;
    }
    return `${this.getChannelUrl().replace(/\/+$/, '')}/live`;
  }

  private async resolveLiveVideoIdFromChannelUrl(): Promise<string | null> {
    const fetched = await this.fetchWithTimeout(
      this.getChannelLiveUrl(),
      {
        redirect: 'follow',
      },
      this.liveUrlTimeoutMs,
    );

    if (!fetched.ok || !fetched.response) {
      return null;
    }

    const finalUrl = fetched.response.url ?? '';
    return this.extractVideoId(finalUrl);
  }

  private async validateLiveVideo(
    videoId: string,
  ): Promise<
    { ok: true; isLive: boolean } | { ok: false; sourceState: LiveSourceState }
  > {
    const params = new URLSearchParams({
      part: 'snippet,liveStreamingDetails',
      id: videoId,
      key: this.apiKey,
    });
    const url = `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`;
    const result = await this.fetchYoutubeJson<YoutubeVideoResponse>(url);
    if (!result.ok) {
      return { ok: false, sourceState: result.state };
    }

    const item = result.data.items?.[0];
    if (!item) {
      return { ok: true, isLive: false };
    }

    const liveBroadcastContent = (
      item.snippet?.liveBroadcastContent ?? ''
    ).toLowerCase();
    const hasStarted = Boolean(item.liveStreamingDetails?.actualStartTime);
    const hasEnded = Boolean(item.liveStreamingDetails?.actualEndTime);
    const isLive = liveBroadcastContent === 'live' || (hasStarted && !hasEnded);
    return { ok: true, isLive };
  }

  private async fetchYoutubeJson<T extends YoutubeApiErrorResponse>(
    url: string,
  ): Promise<{ ok: true; data: T } | { ok: false; state: LiveSourceState }> {
    const fetched = await this.fetchWithTimeout(
      url,
      undefined,
      this.apiTimeoutMs,
    );
    if (!fetched.ok) {
      return { ok: false, state: fetched.state };
    }

    const response = fetched.response;
    const data = (await response.json()) as T;
    if (!response.ok) {
      const reason = data.error?.errors?.[0]?.reason ?? '';
      const message = data.error?.message ?? '';
      if (
        reason.toLowerCase().includes('quota') ||
        message.toLowerCase().includes('quota')
      ) {
        return { ok: false, state: 'quota_exceeded' };
      }
      return { ok: false, state: 'detection_error' };
    }
    return { ok: true, data };
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit | undefined,
    timeoutMs: number,
  ): Promise<
    | { ok: true; response: Response }
    | { ok: false; state: LiveSourceState; response?: Response }
  > {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      return { ok: true, response };
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('aborted'))
      ) {
        return { ok: false, state: 'timeout' };
      }
      this.logger.warn(
        `YouTube request failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { ok: false, state: 'detection_error' };
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractVideoId(url: string): string | null {
    if (!url) return null;
    const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
    if (watchMatch?.[1]) return watchMatch[1];
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
    if (shortMatch?.[1]) return shortMatch[1];
    const embedMatch = url.match(/\/embed\/([a-zA-Z0-9_-]{6,})/);
    if (embedMatch?.[1]) return embedMatch[1];
    return null;
  }
}
