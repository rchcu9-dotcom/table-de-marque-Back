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

type YoutubeChannelResponse = YoutubeApiErrorResponse & {
  items?: Array<{ id?: string }>;
};

type YoutubeSearchResponse = YoutubeApiErrorResponse & {
  items?: Array<{
    id?: { videoId?: string };
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
  private readonly htmlUserAgent =
    process.env.LIVE_HTML_USER_AGENT ??
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  private readonly searchFallbackEnabled =
    (process.env.LIVE_SEARCH_FALLBACK_ENABLED ?? 'false').toLowerCase() ===
    'true';
  private readonly searchFallbackCooldownMs = Number(
    process.env.LIVE_SEARCH_FALLBACK_COOLDOWN_MS ?? '300000',
  );
  private readonly channelIdEnv = process.env.YOUTUBE_CHANNEL_ID ?? '';
  private readonly channelHandle =
    process.env.YOUTUBE_CHANNEL_HANDLE ?? '@titouankerogues2051';

  private lastSearchFallbackAtMs = 0;
  private resolvedChannelId?: string | null;

  async detectLive(): Promise<LiveDetectionResult> {
    const candidates = await this.resolveLiveVideoCandidatesFromChannelUrl();

    let finalCandidates = candidates;
    if (finalCandidates.length === 0) {
      const fallbackCandidates =
        await this.resolveCandidatesViaSearchFallback();
      if (fallbackCandidates.length > 0) {
        finalCandidates = fallbackCandidates;
      }
    }

    if (finalCandidates.length === 0) {
      return { isLive: false, liveVideoId: null, sourceState: 'ok' };
    }

    if (!this.apiKey) {
      return {
        isLive: false,
        liveVideoId: null,
        sourceState: 'detection_error',
      };
    }

    for (const candidateId of finalCandidates) {
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
        headers: {
          'User-Agent': this.htmlUserAgent,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
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

    if (candidates.length > 0) {
      return [...new Set(candidates)];
    }

    this.logger.debug('Live detection: no redirect id, trying HTML parse');
    const html = await this.safeReadText(fetched.response);
    if (!html) {
      this.logger.debug('Live detection: HTML parse failed/no id');
      return [];
    }

    this.logHtmlDiagnostics(html);
    candidates.push(...this.extractVideoIdsFromHtml(html));

    if (candidates.length === 0) {
      this.logger.debug('Live detection: HTML parse failed/no id');
    }
    return [...new Set(candidates)];
  }

  private async resolveCandidatesViaSearchFallback(): Promise<string[]> {
    if (!this.searchFallbackEnabled || !this.apiKey) {
      return [];
    }

    const nowMs = Date.now();
    if (nowMs - this.lastSearchFallbackAtMs < this.searchFallbackCooldownMs) {
      return [];
    }
    this.lastSearchFallbackAtMs = nowMs;

    const channelId = await this.resolveChannelId();
    const params = new URLSearchParams({
      part: 'id',
      eventType: 'live',
      type: 'video',
      maxResults: '3',
      key: this.apiKey,
    });
    if (channelId) {
      params.set('channelId', channelId);
    } else {
      params.set('q', this.channelHandle.replace(/^@/, '').trim());
    }

    const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
    const result = await this.fetchYoutubeJson<YoutubeSearchResponse>(
      url,
      this.apiTimeoutMs,
    );
    if (!result.ok) {
      return [];
    }

    return (result.data.items ?? [])
      .map((item) => item.id?.videoId ?? null)
      .filter((id): id is string => Boolean(id));
  }

  private async resolveChannelId(): Promise<string | null> {
    if (this.resolvedChannelId !== undefined) {
      return this.resolvedChannelId;
    }
    if (this.channelIdEnv) {
      this.resolvedChannelId = this.channelIdEnv;
      return this.channelIdEnv;
    }
    if (!this.apiKey) {
      this.resolvedChannelId = null;
      return null;
    }

    const handle = this.channelHandle.replace(/^@/, '').trim();
    if (!handle) {
      this.resolvedChannelId = null;
      return null;
    }

    const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(
      handle,
    )}&key=${encodeURIComponent(this.apiKey)}`;
    const result = await this.fetchYoutubeJson<YoutubeChannelResponse>(
      url,
      this.apiTimeoutMs,
    );
    if (!result.ok) {
      this.resolvedChannelId = null;
      return null;
    }

    const id = result.data.items?.[0]?.id ?? null;
    this.resolvedChannelId = id;
    return id;
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
    const result = await this.fetchYoutubeJson<YoutubeVideoResponse>(
      url,
      this.apiTimeoutMs,
    );
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
    timeoutMs: number,
  ): Promise<{ ok: true; data: T } | { ok: false; state: LiveSourceState }> {
    const fetched = await this.fetchWithTimeout(url, undefined, timeoutMs);
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

    const player = this.extractJsonByMarker(html, 'ytInitialPlayerResponse');
    if (player && typeof player === 'object') {
      const p = player as Record<string, unknown>;
      const videoDetails = p.videoDetails as
        | Record<string, unknown>
        | undefined;
      const fromVideoDetails =
        typeof videoDetails?.videoId === 'string' ? videoDetails.videoId : null;
      if (fromVideoDetails) {
        ids.push(fromVideoDetails);
      }

      const micro = p.microformat as Record<string, unknown> | undefined;
      const microRenderer = micro?.playerMicroformatRenderer as
        | Record<string, unknown>
        | undefined;
      const canonical = microRenderer?.canonicalUrl;
      if (typeof canonical === 'string') {
        const fromCanonical = this.extractVideoIdFromUrl(canonical);
        if (fromCanonical) {
          ids.push(fromCanonical);
        }
      }
    }

    const initialData = this.extractJsonByMarker(html, 'ytInitialData');
    if (initialData) {
      ids.push(...this.extractLiveCandidatesFromInitialData(initialData));
    }

    const canonicalLink = html.match(
      /<link[^>]+rel="canonical"[^>]+href="https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})[^"]*"/i,
    )?.[1];
    if (canonicalLink) {
      ids.push(canonicalLink);
    }

    return [...new Set(ids)];
  }

  private extractLiveCandidatesFromInitialData(root: unknown): string[] {
    const scored = new Map<string, number>();
    const stack: Array<{ node: unknown; depth: number; ctx: string }> = [
      { node: root, depth: 0, ctx: '' },
    ];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;
      const { node, depth, ctx } = current;
      if (depth > 10 || node === null || node === undefined) continue;

      if (Array.isArray(node)) {
        node.forEach((item) =>
          stack.push({ node: item, depth: depth + 1, ctx }),
        );
        continue;
      }

      if (typeof node !== 'object') continue;
      const obj = node as Record<string, unknown>;
      const currentCtx = `${ctx} ${Object.keys(obj).join(' ')}`.toLowerCase();

      const videoId = typeof obj.videoId === 'string' ? obj.videoId : null;
      if (videoId) {
        let score = scored.get(videoId) ?? 0;
        score += 1;
        if (currentCtx.includes('live')) score += 3;
        if (currentCtx.includes('badge')) score += 1;
        if (currentCtx.includes('thumbnailoverlaytimestatusrenderer'))
          score += 2;
        scored.set(videoId, score);
      }

      Object.values(obj).forEach((value) =>
        stack.push({ node: value, depth: depth + 1, ctx: currentCtx }),
      );
    }

    return [...scored.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }

  private extractJsonByMarker(html: string, marker: string): unknown {
    const markerRegexes = [
      new RegExp(`${marker}\\s*=\\s*`),
      new RegExp(`"${marker}"\\s*:\\s*`),
    ];

    for (const markerRegex of markerRegexes) {
      const markerMatch = markerRegex.exec(html);
      if (!markerMatch) continue;

      const markerIndex = markerMatch.index + markerMatch[0].length;
      const start = html.indexOf('{', markerIndex);
      if (start < 0) continue;

      const jsonText = this.readBalancedJsonObject(html, start);
      if (!jsonText) continue;
      try {
        return JSON.parse(jsonText) as unknown;
      } catch {
        continue;
      }
    }
    return null;
  }

  private readBalancedJsonObject(
    text: string,
    startIndex: number,
  ): string | null {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = startIndex; i < text.length; i += 1) {
      const char = text[i];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          return text.slice(startIndex, i + 1);
        }
      }
    }
    return null;
  }

  private logHtmlDiagnostics(html: string) {
    const markers = {
      ytInitialPlayerResponse: html.includes('ytInitialPlayerResponse'),
      ytInitialData: html.includes('ytInitialData'),
      canonical: /rel="canonical"/i.test(html),
      videoId: html.includes('videoId'),
    };
    const snippet = this.sanitizeSnippet(html.slice(0, 240));
    this.logger.debug(
      `Live detection: html diagnostics len=${html.length} markers=${JSON.stringify(
        markers,
      )} snippet="${snippet}"`,
    );
  }

  private sanitizeSnippet(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\x20-\x7E]/g, '?')
      .trim();
  }

  private maskVideoId(videoId: string): string {
    if (videoId.length <= 6) return videoId;
    return `${videoId.slice(0, 3)}***${videoId.slice(-3)}`;
  }
}
