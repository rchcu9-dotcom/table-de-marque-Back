import { LiveCacheService } from '@/infrastructure/http/live/live-cache.service';
import type {
  LiveDetectionResult,
  LiveStatusResponse,
} from '@/infrastructure/http/live/live.types';

const makeDetection = ({
  isLive,
  sourceState = 'ok',
  liveVideoId = isLive ? 'live-123' : null,
}: {
  isLive: boolean;
  sourceState?: LiveStatusResponse['sourceState'];
  liveVideoId?: string | null;
}): LiveDetectionResult => ({
  isLive,
  sourceState,
  liveVideoId,
});

describe('LiveCacheService anti-flap', () => {
  const originalEnv = { ...process.env };

  const createService = () => {
    const detectionService = {
      detectLive: jest.fn<Promise<LiveDetectionResult>, []>(),
      getChannelUrl: jest.fn(() => 'https://www.youtube.com/@test-channel'),
    };
    const stream = {
      emit: jest.fn(),
    };
    const service = new LiveCacheService(
      detectionService as never,
      stream as never,
    );
    return { service, detectionService, stream };
  };

  beforeEach(() => {
    process.env.LIVE_FALLBACK_VIDEO_ID = 'fallback-123';
    process.env.LIVE_POLLING_INTERVAL_MS = '30';
    process.env.LIVE_CACHE_TTL_MS = '60000';
    process.env.LIVE_QUOTA_COOLDOWN_MS = '300000';
    process.env.LIVE_FORCE_ENABLED = 'false';
    process.env.LIVE_FORCE_VIDEO_ID = '';
    process.env.LIVE_FALLBACK_STREAK_THRESHOLD = '2';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('etat live + 1 echec conserve le live (streak 1/N)', async () => {
    const { service, detectionService } = createService();

    detectionService.detectLive.mockResolvedValueOnce(makeDetection({ isLive: true }));
    const first = await service.refresh(true);
    expect(first.isLive).toBe(true);

    detectionService.detectLive.mockResolvedValueOnce(
      makeDetection({ isLive: false, sourceState: 'ok', liveVideoId: null }),
    );
    const second = await service.refresh(false);

    expect(second.isLive).toBe(true);
    expect(second.mode).toBe('live');
  });

  it('etat live + N echecs consecutifs bascule en fallback', async () => {
    const { service, detectionService } = createService();

    detectionService.detectLive.mockResolvedValueOnce(makeDetection({ isLive: true }));
    await service.refresh(true);

    detectionService.detectLive.mockResolvedValueOnce(
      makeDetection({ isLive: false, sourceState: 'ok', liveVideoId: null }),
    );
    const keepLive = await service.refresh(false);
    expect(keepLive.isLive).toBe(true);

    detectionService.detectLive.mockResolvedValueOnce(
      makeDetection({ isLive: false, sourceState: 'ok', liveVideoId: null }),
    );
    const fallback = await service.refresh(false);
    expect(fallback.isLive).toBe(false);
    expect(fallback.mode).toBe('fallback');
  });

  it('retour live valide reset la streak puis reste live sur echec ponctuel suivant', async () => {
    const { service, detectionService } = createService();

    detectionService.detectLive.mockResolvedValueOnce(
      makeDetection({ isLive: true, liveVideoId: 'live-aaa' }),
    );
    await service.refresh(true);

    detectionService.detectLive.mockResolvedValueOnce(
      makeDetection({ isLive: false, sourceState: 'ok', liveVideoId: null }),
    );
    await service.refresh(false); // streak=1, still live

    detectionService.detectLive.mockResolvedValueOnce(
      makeDetection({ isLive: true, liveVideoId: 'live-bbb' }),
    );
    const backLive = await service.refresh(false);
    expect(backLive.isLive).toBe(true);
    expect(backLive.liveVideoId).toBe('live-bbb');

    detectionService.detectLive.mockResolvedValueOnce(
      makeDetection({ isLive: false, sourceState: 'ok', liveVideoId: null }),
    );
    const afterReset = await service.refresh(false);
    expect(afterReset.isLive).toBe(true);
    expect(afterReset.liveVideoId).toBe('live-bbb');
  });

  it('applique le seuil parametre LIVE_FALLBACK_STREAK_THRESHOLD', async () => {
    process.env.LIVE_FALLBACK_STREAK_THRESHOLD = '1';
    const { service, detectionService } = createService();

    detectionService.detectLive.mockResolvedValueOnce(makeDetection({ isLive: true }));
    await service.refresh(true);

    detectionService.detectLive.mockResolvedValueOnce(
      makeDetection({ isLive: false, sourceState: 'ok', liveVideoId: null }),
    );
    const immediateFallback = await service.refresh(false);

    expect(immediateFallback.isLive).toBe(false);
    expect(immediateFallback.mode).toBe('fallback');
  });
});
