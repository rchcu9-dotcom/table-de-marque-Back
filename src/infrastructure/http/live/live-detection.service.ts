import { Injectable, Logger } from '@nestjs/common';

import { LiveDetectionResult, LiveSourceState } from './live.types';

type YoutubeSearchResponse = {
  items?: Array<{
    id?: {
      videoId?: string;
      channelId?: string;
    };
  }>;
  error?: {
    errors?: Array<{ reason?: string }>;
    message?: string;
  };
};

type YoutubeChannelsResponse = {
  items?: Array<{
    id?: string;
  }>;
  error?: {
    errors?: Array<{ reason?: string }>;
    message?: string;
  };
};

@Injectable()
export class LiveDetectionService {
  private readonly logger = new Logger(LiveDetectionService.name);
  private readonly apiKey = process.env.YOUTUBE_API_KEY ?? '';
  private readonly timeoutMs = Number(
    process.env.LIVE_DETECTION_TIMEOUT_MS ?? '3000',
  );
  private readonly channelIdEnv = process.env.YOUTUBE_CHANNEL_ID ?? '';
  private readonly channelHandle =
    process.env.YOUTUBE_CHANNEL_HANDLE ?? '@titouankerogues2051';
  private resolvedChannelId?: string | null;

  async detectLive(): Promise<LiveDetectionResult> {
    if (!this.apiKey) {
      return {
        isLive: false,
        liveVideoId: null,
        sourceState: 'detection_error',
      };
    }

    const channelIdResult = await this.resolveChannelId();
    if (!channelIdResult.channelId) {
      return {
        isLive: false,
        liveVideoId: null,
        sourceState: channelIdResult.sourceState,
      };
    }

    const params = new URLSearchParams({
      part: 'id',
      channelId: channelIdResult.channelId,
      eventType: 'live',
      type: 'video',
      maxResults: '1',
      key: this.apiKey,
    });
    const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
    const result = await this.fetchYoutubeJson(url);

    if (!result.ok) {
      return { isLive: false, liveVideoId: null, sourceState: result.state };
    }

    const json = result.data as YoutubeSearchResponse;
    const videoId = json.items?.[0]?.id?.videoId ?? null;
    return {
      isLive: Boolean(videoId),
      liveVideoId: videoId,
      sourceState: 'ok',
    };
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

  private async resolveChannelId(): Promise<{
    channelId: string | null;
    sourceState: LiveSourceState;
  }> {
    if (this.resolvedChannelId !== undefined) {
      return { channelId: this.resolvedChannelId, sourceState: 'ok' };
    }
    if (this.channelIdEnv) {
      this.resolvedChannelId = this.channelIdEnv;
      return { channelId: this.channelIdEnv, sourceState: 'ok' };
    }

    const handle = this.channelHandle.replace(/^@/, '').trim();
    if (!handle) {
      this.resolvedChannelId = null;
      return { channelId: null, sourceState: 'detection_error' };
    }

    const channelsUrl = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(
      handle,
    )}&key=${encodeURIComponent(this.apiKey)}`;
    const channelsResult = await this.fetchYoutubeJson(channelsUrl);
    if (channelsResult.ok) {
      const json = channelsResult.data as YoutubeChannelsResponse;
      const channelId = json.items?.[0]?.id ?? null;
      if (channelId) {
        this.resolvedChannelId = channelId;
        return { channelId, sourceState: 'ok' };
      }
    } else if (
      channelsResult.state === 'timeout' ||
      channelsResult.state === 'quota_exceeded'
    ) {
      return { channelId: null, sourceState: channelsResult.state };
    }

    const searchParams = new URLSearchParams({
      part: 'id',
      type: 'channel',
      q: handle,
      maxResults: '1',
      key: this.apiKey,
    });
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`;
    const searchResult = await this.fetchYoutubeJson(searchUrl);
    if (!searchResult.ok) {
      return { channelId: null, sourceState: searchResult.state };
    }

    const searchJson = searchResult.data as YoutubeSearchResponse;
    const fallbackChannelId = searchJson.items?.[0]?.id?.channelId ?? null;
    this.resolvedChannelId = fallbackChannelId;
    return {
      channelId: fallbackChannelId,
      sourceState: fallbackChannelId ? 'ok' : 'detection_error',
    };
  }

  private async fetchYoutubeJson(
    url: string,
  ): Promise<
    { ok: true; data: unknown } | { ok: false; state: LiveSourceState }
  > {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      const data = (await response.json()) as YoutubeSearchResponse;
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
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('aborted'))
      ) {
        return { ok: false, state: 'timeout' };
      }
      this.logger.warn(
        `YouTube API request failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { ok: false, state: 'detection_error' };
    } finally {
      clearTimeout(timeout);
    }
  }
}
