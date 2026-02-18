import { LiveDetectionService } from '@/infrastructure/http/live/live-detection.service';

describe('LiveDetectionService (low quota strategy)', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = 'test-api-key';
    process.env.YOUTUBE_CHANNEL_HANDLE = '@testchannel';
    process.env.YOUTUBE_CHANNEL_ID = '';
    process.env.LIVE_DETECTION_TIMEOUT_MS = '3000';
    process.env.LIVE_LIVEURL_TIMEOUT_MS = '3000';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('detecte live=true via parsing HTML de /live puis validation videos.list', async () => {
    const urls: string[] = [];
    global.fetch = jest
      .fn()
      .mockImplementationOnce(async (url: string) => {
        urls.push(url);
        return new Response(
          `
          <html>
            <script>
              var ytInitialPlayerResponse = {"videoDetails":{"videoId":"live123"},"isLive":true};
            </script>
          </html>
          `,
          {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          },
        );
      })
      .mockImplementationOnce(async (url: string) => {
        urls.push(url);
        return new Response(
          JSON.stringify({
            items: [
              {
                snippet: { liveBroadcastContent: 'live' },
                liveStreamingDetails: { actualStartTime: '2026-02-17T10:00:00Z' },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }) as unknown as typeof fetch;

    const service = new LiveDetectionService();
    const result = await service.detectLive();

    expect(result).toEqual({
      isLive: true,
      liveVideoId: 'live123',
      sourceState: 'ok',
    });
    expect(urls[0]).toContain('/live');
    expect(urls[0]).not.toContain('watch?v=');
    expect(urls[1]).toContain('/youtube/v3/videos');
    expect(urls[1]).toContain('id=live123');
    expect(urls.join(' ')).not.toContain('/youtube/v3/search');
  });

  it('retourne fallback ok quand /live ne fournit pas de videoId', async () => {
    const urls: string[] = [];
    global.fetch = jest.fn(async (url: string) => {
      urls.push(url);
      return new Response('', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    }) as unknown as typeof fetch;

    const service = new LiveDetectionService();
    const result = await service.detectLive();

    expect(result).toEqual({
      isLive: false,
      liveVideoId: null,
      sourceState: 'ok',
    });
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('/live');
  });

  it('selectionne un videoId pertinent quand HTML contient plusieurs IDs', async () => {
    const urls: string[] = [];
    global.fetch = jest
      .fn()
      .mockImplementationOnce(async (url: string) => {
        urls.push(url);
        return new Response(
          `
          <html>
            <script>
              var stale = {"videoId":"old111","title":"Replay archive"};
              var spacer = "${'x'.repeat(500)}";
              var best = {
                "videoId":"best222",
                "isLive":true,
                "liveBroadcastContent":"live",
                "hlsManifestUrl":"https://cdn/live.m3u8",
                "watchUrl":"https://www.youtube.com/watch?v=best222"
              };
            </script>
          </html>
          `,
          {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          },
        );
      })
      .mockImplementationOnce(async (url: string) => {
        urls.push(url);
        return new Response(
          JSON.stringify({
            items: [
              {
                snippet: { liveBroadcastContent: 'live' },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }) as unknown as typeof fetch;

    const service = new LiveDetectionService();
    const result = await service.detectLive();

    expect(result).toEqual({
      isLive: true,
      liveVideoId: 'best222',
      sourceState: 'ok',
    });
    expect(urls[1]).toContain('id=best222');
  });

  it('retourne fallback ok si timeout sur URL /live', async () => {
    global.fetch = jest.fn(async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    }) as unknown as typeof fetch;

    const service = new LiveDetectionService();
    const result = await service.detectLive();

    expect(result).toEqual({
      isLive: false,
      liveVideoId: null,
      sourceState: 'ok',
    });
  });

  it('retourne quota_exceeded quand videos.list est limite', async () => {
    global.fetch = jest
      .fn()
      .mockImplementationOnce(async () => {
        return {
          ok: true,
          url: 'https://www.youtube.com/watch?v=live123',
        } as Response;
      })
      .mockImplementationOnce(async () => {
        return new Response(
          JSON.stringify({
            error: {
              message: 'quota exceeded',
              errors: [{ reason: 'quotaExceeded' }],
            },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      }) as unknown as typeof fetch;

    const service = new LiveDetectionService();
    const result = await service.detectLive();

    expect(result).toEqual({
      isLive: false,
      liveVideoId: null,
      sourceState: 'quota_exceeded',
    });
  });

  it('retourne timeout quand videos.list timeout', async () => {
    global.fetch = jest
      .fn()
      .mockImplementationOnce(async () => {
        return {
          ok: true,
          url: 'https://www.youtube.com/watch?v=live123',
        } as Response;
      })
      .mockImplementationOnce(async () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      }) as unknown as typeof fetch;

    const service = new LiveDetectionService();
    const result = await service.detectLive();

    expect(result).toEqual({
      isLive: false,
      liveVideoId: null,
      sourceState: 'timeout',
    });
  });

  it('retourne detection_error quand videos.list repond en erreur non quota', async () => {
    global.fetch = jest
      .fn()
      .mockImplementationOnce(async () => {
        return {
          ok: true,
          url: 'https://www.youtube.com/watch?v=live123',
        } as Response;
      })
      .mockImplementationOnce(async () => {
        return new Response(
          JSON.stringify({
            error: {
              message: 'forbidden',
              errors: [{ reason: 'forbidden' }],
            },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      }) as unknown as typeof fetch;

    const service = new LiveDetectionService();
    const result = await service.detectLive();

    expect(result).toEqual({
      isLive: false,
      liveVideoId: null,
      sourceState: 'detection_error',
    });
  });

  it('LIVE_FORCE_* reste gere par le cache et n impacte pas detectLive', async () => {
    process.env.LIVE_FORCE_ENABLED = 'true';
    process.env.LIVE_FORCE_VIDEO_ID = 'forced-id';
    global.fetch = jest.fn(async () => {
      return new Response('', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    }) as unknown as typeof fetch;

    const service = new LiveDetectionService();
    const result = await service.detectLive();

    expect(result.isLive).toBe(false);
  });
});
