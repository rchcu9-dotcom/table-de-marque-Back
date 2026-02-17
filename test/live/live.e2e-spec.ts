import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventEmitter } from 'events';
import request from 'supertest';

import { LiveStreamService } from '@/hooks/live-stream.service';
import { LiveCacheService } from '@/infrastructure/http/live/live-cache.service';
import { LiveDetectionService } from '@/infrastructure/http/live/live-detection.service';
import { LiveModule } from '@/infrastructure/http/live/live.module';
import type {
  LiveDetectionResult,
  LiveSourceState,
} from '@/infrastructure/http/live/live.types';
import { LiveStreamController } from '@/infrastructure/http/live/live.stream.controller';

type MockReq = EventEmitter & { query: Record<string, string> };
type MockRes = {
  writeHead: jest.Mock;
  write: jest.Mock;
  end: jest.Mock;
};

const makeDetectionResult = (
  sourceState: LiveSourceState,
): LiveDetectionResult => ({
  isLive: sourceState === 'ok',
  liveVideoId: sourceState === 'ok' ? 'live-123' : null,
  sourceState,
});

describe('Live endpoints integration', () => {
  let app: INestApplication;
  let cache: LiveCacheService;
  let stream: LiveStreamService;
  let controller: LiveStreamController;

  const detectionServiceMock = {
    detectLive: jest.fn<Promise<LiveDetectionResult>, []>(),
    getChannelUrl: jest.fn(() => 'https://www.youtube.com/@test-channel'),
  };

  const originalEnv = { ...process.env };

  const createMockSseContext = (query: Record<string, string> = {}) => {
    const req = new EventEmitter() as MockReq;
    req.query = query;

    const res: MockRes = {
      writeHead: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };

    return { req, res };
  };

  beforeAll(async () => {
    process.env.LIVE_POLLING_ENABLED = 'false';
    process.env.LIVE_CACHE_TTL_MS = '10';
    process.env.LIVE_POLLING_INTERVAL_MS = '30';
    process.env.LIVE_FALLBACK_VIDEO_ID = 'fallback-123';

    detectionServiceMock.detectLive.mockResolvedValue(makeDetectionResult('ok'));

    const moduleRef = await Test.createTestingModule({
      imports: [LiveModule],
    })
      .overrideProvider(LiveDetectionService)
      .useValue(detectionServiceMock)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    cache = app.get(LiveCacheService);
    stream = app.get(LiveStreamService);
    controller = app.get(LiveStreamController);
  });

  afterAll(async () => {
    await app.close();
    process.env = { ...originalEnv };
  });

  beforeEach(() => {
    detectionServiceMock.detectLive.mockReset();
    detectionServiceMock.getChannelUrl.mockClear();
    detectionServiceMock.getChannelUrl.mockReturnValue(
      'https://www.youtube.com/@test-channel',
    );
  });

  it.each([
    'ok',
    'detection_error',
    'timeout',
    'quota_exceeded',
  ] as const)(
    'GET /live/status renvoie un payload exploitable avec sourceState=%s',
    async (sourceState) => {
      detectionServiceMock.detectLive.mockResolvedValue(
        makeDetectionResult(sourceState),
      );
      await cache.refresh(true);

      const res = await request(app.getHttpServer()).get('/live/status').expect(200);

      expect(res.body).toEqual(
        expect.objectContaining({
          isLive: sourceState === 'ok',
          mode: sourceState === 'ok' ? 'live' : 'fallback',
          sourceState,
          fallbackEmbedUrl: expect.stringContaining('/fallback-123'),
          nextRefreshInSec: 1,
          channelUrl: 'https://www.youtube.com/@test-channel',
        }),
      );
    },
  );

  it('GET /live/stream renvoie le replay initial (once=true)', async () => {
    detectionServiceMock.detectLive.mockResolvedValue(makeDetectionResult('ok'));
    await cache.refresh(true);

    const { req, res } = createMockSseContext({ once: 'true' });
    controller.stream(req as never, res as never);

    const writes = res.write.mock.calls.map((call) => String(call[0]));
    expect(writes.join('')).toContain(':ok');
    expect(writes.join('')).toContain('event: live_status');
    expect(writes.join('')).toContain('"type":"live_status"');

    req.emit('close');
    expect(res.end).toHaveBeenCalled();
  });

  it('GET /live/stream emet un keepalive ping', async () => {
    jest.useFakeTimers();
    detectionServiceMock.detectLive.mockResolvedValue(makeDetectionResult('ok'));
    await cache.refresh(true);

    const { req, res } = createMockSseContext();
    controller.stream(req as never, res as never);

    jest.advanceTimersByTime(25_000);

    const writes = res.write.mock.calls.map((call) => String(call[0])).join('');
    expect(writes).toContain('event: ping');
    expect(writes).toContain('"type":"ping"');

    req.emit('close');
    jest.useRealTimers();
  });

  it('n emet un event live_status que sur changement reel', async () => {
    const received: Array<{ type: string; version: string }> = [];
    const subscription = stream.observe().subscribe((event) => {
      received.push({ type: event.type, version: event.version });
    });

    detectionServiceMock.detectLive.mockResolvedValue(makeDetectionResult('ok'));
    await cache.refresh(true);

    detectionServiceMock.detectLive.mockResolvedValue(makeDetectionResult('ok'));
    await cache.refresh(false);

    detectionServiceMock.detectLive.mockResolvedValue({
      isLive: true,
      liveVideoId: 'live-456',
      sourceState: 'ok',
    });
    await cache.refresh(false);

    subscription.unsubscribe();

    expect(received).toHaveLength(2);
    expect(received[0].type).toBe('live_status');
    expect(received[1].type).toBe('live_status');
    expect(received[0].version).not.toBe(received[1].version);
  });
});
