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
    process.env.LIVE_SEARCH_FALLBACK_ENABLED = 'false';
    process.env.LIVE_SEARCH_FALLBACK_COOLDOWN_MS = '300000';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('variant A: ytInitialPlayerResponse -> extraction videoId OK + headers browser-like', async () => {
    const urls: string[] = [];
    const options: Array<RequestInit | undefined> = [];
    global.fetch = jest
      .fn(async (url: string, init?: RequestInit) => {
        urls.push(url);
        options.push(init);
        if (urls.length === 1) {
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
        }
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
    expect(options[0]?.redirect).toBe('follow');
    expect(options[0]?.headers).toEqual(
      expect.objectContaining({
        'User-Agent': expect.any(String),
        Accept: expect.stringContaining('text/html'),
        'Accept-Language': expect.any(String),
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      }),
    );
    expect(urls[1]).toContain('/youtube/v3/videos');
    expect(urls[1]).toContain('id=live123');
    expect(urls.join(' ')).not.toContain('/youtube/v3/search');
  });

  it('variant B: ytInitialData sans player response -> extraction videoId OK', async () => {
    const urls: string[] = [];
    global.fetch = jest
      .fn()
      .mockImplementationOnce(async (url: string) => {
        urls.push(url);
        return new Response(
          `
          <html>
            <script>
              var ytInitialData = {
                "contents":{
                  "liveRenderer":{
                    "videoId":"liveFromData1",
                    "liveBadgeRenderer":{"label":"LIVE"}
                  }
                }
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
      liveVideoId: 'liveFromData1',
      sourceState: 'ok',
    });
    expect(urls[1]).toContain('id=liveFromData1');
  });

  it('variant C: canonical watch URL seul -> extraction videoId OK', async () => {
    const urls: string[] = [];
    global.fetch = jest
      .fn()
      .mockImplementationOnce(async (url: string) => {
        urls.push(url);
        return new Response(
          `
          <html>
            <head>
              <link rel="canonical" href="https://www.youtube.com/watch?v=canon123" />
            </head>
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
      liveVideoId: 'canon123',
      sourceState: 'ok',
    });
    expect(urls[1]).toContain('id=canon123');
  });

  it('variant D: aucun candidat + search fallback disabled -> fallback propre', async () => {
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
    expect(urls.join(' ')).not.toContain('/youtube/v3/search');
  });

  it('variant E: aucun candidat + search fallback enabled -> search.list puis videos.list', async () => {
    process.env.LIVE_SEARCH_FALLBACK_ENABLED = 'true';
    process.env.YOUTUBE_CHANNEL_ID = 'channel-x';

    const urls: string[] = [];
    global.fetch = jest
      .fn()
      .mockImplementationOnce(async (url: string) => {
        urls.push(url);
        return new Response('<html><body>no candidates</body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });
      })
      .mockImplementationOnce(async (url: string) => {
        urls.push(url);
        return new Response(
          JSON.stringify({
            items: [{ id: { videoId: 'searchLive123' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      })
      .mockImplementationOnce(async (url: string) => {
        urls.push(url);
        return new Response(
          JSON.stringify({
            items: [{ snippet: { liveBroadcastContent: 'live' } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }) as unknown as typeof fetch;

    const service = new LiveDetectionService();
    const result = await service.detectLive();

    expect(result).toEqual({
      isLive: true,
      liveVideoId: 'searchLive123',
      sourceState: 'ok',
    });
    expect(urls[1]).toContain('/youtube/v3/search');
    expect(urls[1]).toContain('channelId=channel-x');
    expect(urls[2]).toContain('/youtube/v3/videos');
    expect(urls[2]).toContain('id=searchLive123');
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
              var ytInitialPlayerResponse = {
                "videoDetails":{"videoId":"old111"},
                "microformat":{
                  "playerMicroformatRenderer":{
                    "canonicalUrl":"https://www.youtube.com/watch?v=best222"
                  }
                }
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
                snippet: { liveBroadcastContent: 'none' },
                liveStreamingDetails: {
                  actualStartTime: '2026-02-17T10:00:00Z',
                  actualEndTime: '2026-02-17T11:00:00Z',
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
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
    expect(urls[1]).toContain('id=old111');
    expect(urls[2]).toContain('id=best222');
  });

  it('rejette un candidat si videos.list indique non-live', async () => {
    global.fetch = jest
      .fn()
      .mockImplementationOnce(async () => {
        return new Response(
          `
          <html>
            <script>var candidate = {"videoId":"notlive123","isLive":true};</script>
          </html>
          `,
          {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          },
        );
      })
      .mockImplementationOnce(async () => {
        return new Response(
          JSON.stringify({
            items: [
              {
                snippet: { liveBroadcastContent: 'none' },
                liveStreamingDetails: {
                  actualStartTime: '2026-02-17T10:00:00Z',
                  actualEndTime: '2026-02-17T11:00:00Z',
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }) as unknown as typeof fetch;

    const service = new LiveDetectionService();
    const result = await service.detectLive();

    expect(result).toEqual({
      isLive: false,
      liveVideoId: null,
      sourceState: 'ok',
    });
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

  it('applique la regle stricte live si started && !ended (meme sans liveBroadcastContent=live)', async () => {
    global.fetch = jest
      .fn()
      .mockImplementationOnce(async () => {
        return {
          ok: true,
          url: 'https://www.youtube.com/watch?v=strict123',
        } as Response;
      })
      .mockImplementationOnce(async () => {
        return new Response(
          JSON.stringify({
            items: [
              {
                snippet: { liveBroadcastContent: 'none' },
                liveStreamingDetails: {
                  actualStartTime: '2026-02-18T10:00:00Z',
                },
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
      liveVideoId: 'strict123',
      sourceState: 'ok',
    });
  });

  it('n utilise pas un parsing global permissif pour des IDs aleatoires', async () => {
    const urls: string[] = [];
    global.fetch = jest.fn(async (url: string) => {
      urls.push(url);
      return new Response(
        `
        <html>
          <body>
            token="AbCdEf12345"
            payload={"id":"ZZYYXX99887"}
            <!-- no canonical videoId/watch/embed -->
          </body>
        </html>
        `,
        {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        },
      );
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

  it('cooldown search: ne relance pas search.list agressivement pendant la fenetre', async () => {
    process.env.LIVE_SEARCH_FALLBACK_ENABLED = 'true';
    process.env.LIVE_SEARCH_FALLBACK_COOLDOWN_MS = '600000';
    process.env.YOUTUBE_CHANNEL_ID = 'channel-x';

    const urls: string[] = [];
    global.fetch = jest
      .fn()
      .mockImplementation(async (url: string) => {
        urls.push(url);
        if (url.includes('/live')) {
          return new Response('<html><body>no candidates</body></html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          });
        }
        if (url.includes('/youtube/v3/search')) {
          return new Response(JSON.stringify({ items: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as unknown as typeof fetch;

    const service = new LiveDetectionService();
    await service.detectLive();
    await service.detectLive();

    const searchCalls = urls.filter((url) => url.includes('/youtube/v3/search'));
    expect(searchCalls).toHaveLength(1);
  });
});
