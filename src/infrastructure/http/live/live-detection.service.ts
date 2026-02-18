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
    const candidates = await this.resolveLiveVideoCandidatesFromChannelUrl();
    if (candidates.length === 0) {
      return { isLive: false, liveVideoId: null, sourceState: 'ok' };
    }

    if (!this.apiKey) {
      return {
        isLive: false,
        liveVideoId: null,
        sourceState: 'detection_error',
      };
    }

    for (const candidateId of candidates) {
      this.logger.debug(
        `Live detection: live candidate chosen: ${this.maskVideoId(candidateId)}`,
      );
      const validation = await this.validateLiveVideo(candidateId);
      if (!validation.ok) {
        this.logger.debug(
          `Live detection: live candidate validated=false (${validation.sourceState})`,
        );
        return {
          isLive: false,
          liveVideoId: null,
          sourceState: validation.sourceState,
        };
      }

      this.logger.debug(
        `Live detection: live candidate validated=${validation.isLive}`,
      );
      if (validation.isLive) {
        return { isLive: true, liveVideoId: candidateId, sourceState: 'ok' };
      }
    }

    return { isLive: false, liveVideoId: null, sourceState: 'ok' };
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

  private async resolveLiveVideoCandidatesFromChannelUrl(): Promise<string[]> {
    const fetched = await this.fetchWithTimeout(
      this.getChannelLiveUrl(),
      {
        redirect: 'follow',
      },
      this.liveUrlTimeoutMs,
    );

    if (!fetched.ok || !fetched.response) {
      return [];
    }

    const candidates: string[] = [];
    const finalUrl = fetched.response.url ?? '';
    const fromUrl = this.extractVideoIdFromUrl(finalUrl);
    if (fromUrl) {
      candidates.push(fromUrl);
    }

    if (candidates.length === 0) {
      this.logger.debug('Live detection: no redirect id, trying HTML parse');
      const html = await this.safeReadText(fetched.response);
      if (!html) {
        this.logger.debug('Live detection: HTML parse failed/no id');
        return [];
      }
      const fromHtml = this.extractVideoIdsFromHtml(html);
      if (fromHtml.length === 0) {
        this.logger.debug('Live detection: HTML parse failed/no id');
      }
      candidates.push(...fromHtml);
    }

    return [...new Set(candidates)];
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

  private extractVideoIdFromUrl(url: string): string | null {
    if (!url) return null;
    const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
    if (watchMatch?.[1]) return watchMatch[1];
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
    if (shortMatch?.[1]) return shortMatch[1];
    const embedMatch = url.match(/\/embed\/([a-zA-Z0-9_-]{6,})/);
    if (embedMatch?.[1]) return embedMatch[1];
    return null;
  }

  private async safeReadText(response: Response): Promise<string | null> {
    try {
      return await response.text();
    } catch {
      return null;
    }
  }

  private extractVideoIdsFromHtml(html: string): string[] {
    const ids: string[] = [];

    const playerWindow = this.extractWindow(
      html,
      'ytInitialPlayerResponse',
      8000,
    );
    if (playerWindow) {
      const fromVideoDetails = playerWindow.match(
        /"videoDetails"\s*:\s*\{[\s\S]*?"videoId"\s*:\s*"([a-zA-Z0-9_-]{6,})"/,
      )?.[1];
      if (fromVideoDetails) {
        ids.push(fromVideoDetails);
      }

      const fromCanonical = playerWindow.match(
        /"canonicalBaseUrl"\s*:\s*"\/watch\?v=([a-zA-Z0-9_-]{6,})"/,
      )?.[1];
      if (fromCanonical) {
        ids.push(fromCanonical);
      }
    }

    const canonicalLink = html.match(
      /<link[^>]+rel="canonical"[^>]+href="https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})[^"]*"/i,
    )?.[1];
    if (canonicalLink) {
      ids.push(canonicalLink);
    }

    const liveContextWindow = this.extractWindow(
      html,
      'liveStreamingDetails',
      4000,
    );
    if (liveContextWindow) {
      const liveContextVideoId = liveContextWindow.match(
        /"videoId"\s*:\s*"([a-zA-Z0-9_-]{6,})"/,
      )?.[1];
      if (liveContextVideoId) {
        ids.push(liveContextVideoId);
      }
    }

    return [...new Set(ids)];
  }

  private extractWindow(
    text: string,
    marker: string,
    length: number,
  ): string | null {
    const idx = text.indexOf(marker);
    if (idx < 0) return null;
    const end = Math.min(text.length, idx + length);
    return text.slice(idx, end);
  }

  private maskVideoId(videoId: string): string {
    if (videoId.length <= 6) return videoId;
    return `${videoId.slice(0, 3)}***${videoId.slice(-3)}`;
  }
}
