/* eslint-disable */
import { HttpException } from '@nestjs/common';
import { HealthService, DRIVERS_ENV_KEYS } from './health.service';
import { PrismaService } from '@/infrastructure/persistence/mysql/prisma.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePrisma(impl?: () => Promise<unknown>): PrismaService {
  return {
    $queryRaw: jest.fn().mockImplementation(impl ?? (() => Promise.resolve([{ 1: 1 }]))),
  } as unknown as PrismaService;
}

/** Set every DRIVERS_ENV_KEYS env var to the given value (or delete it). */
function setAllDrivers(value: string | undefined): void {
  for (const key of DRIVERS_ENV_KEYS) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('HealthService', () => {
  let prisma: PrismaService;
  let service: HealthService;

  // Save and restore env vars around each test
  let savedEnv: Record<string, string | undefined>;

  // Use fake timers throughout so the internal 3-second setTimeout
  // (inside Promise.race) never leaks into the real event loop.
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    savedEnv = {};
    for (const key of DRIVERS_ENV_KEYS) {
      savedEnv[key] = process.env[key];
    }
    jest.clearAllMocks();
  });

  afterEach(() => {
    for (const key of DRIVERS_ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
    // Drain any pending timers so no handles leak between tests
    jest.runAllTimers();
  });

  // -------------------------------------------------------------------------
  // Case 1 — "ok" : driver = prisma, DB responds in time
  // -------------------------------------------------------------------------
  describe('when driver is prisma and DB responds in time', () => {
    it('returns a complete HealthPayload with status "ok"', async () => {
      setAllDrivers(undefined);
      process.env.MATCH_REPOSITORY_DRIVER = 'prisma';

      prisma = makePrisma(() => Promise.resolve([{ 1: 1 }]));
      service = new HealthService(prisma);

      const result = await service.check();

      expect(result.status).toBe('ok');
      expect(result.db.status).toBe('ok');
      expect(typeof result.db.latencyMs).toBe('number');
      expect(result.db.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.db.error).toBeUndefined();

      // Shape checks for the top-level fields
      expect(typeof result.timestamp).toBe('string');
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
      expect(typeof result.uptime).toBe('number');
      expect(typeof result.version).toBe('string');
      expect(typeof result.environment).toBe('string');

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Case 2 — "degraded" : no driver = prisma
  // -------------------------------------------------------------------------
  describe('when no driver is set to "prisma"', () => {
    it('returns status "degraded" with db.status "not_configured" without throwing', async () => {
      setAllDrivers('memory');

      prisma = makePrisma();
      service = new HealthService(prisma);

      const result = await service.check();

      expect(result.status).toBe('degraded');
      expect(result.db.status).toBe('not_configured');
      expect(result.db.latencyMs).toBeNull();
      expect(result.db.error).toBeUndefined();

      // DB must NOT have been queried
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('also works when driver env vars are entirely absent', async () => {
      setAllDrivers(undefined);

      prisma = makePrisma();
      service = new HealthService(prisma);

      const result = await service.check();

      expect(result.status).toBe('degraded');
      expect(result.db.status).toBe('not_configured');
    });
  });

  // -------------------------------------------------------------------------
  // Case 3 — DB unreachable: $queryRaw rejects with a connection error
  // -------------------------------------------------------------------------
  describe('when DB is unreachable ($queryRaw rejects)', () => {
    it('throws HttpException 503 with the correct error payload', async () => {
      setAllDrivers(undefined);
      process.env.MATCH_REPOSITORY_DRIVER = 'prisma';

      prisma = makePrisma(() => Promise.reject(new Error('ECONNREFUSED')));
      service = new HealthService(prisma);

      let caught: unknown;
      try {
        await service.check();
      } catch (err: unknown) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(HttpException);
      const httpErr = caught as HttpException;
      expect(httpErr.getStatus()).toBe(503);

      const body = httpErr.getResponse() as Record<string, unknown>;
      expect(body.status).toBe('error');

      const db = body.db as Record<string, unknown>;
      expect(db.status).toBe('error');
      expect(db.error).toBe('ECONNREFUSED');
      expect(typeof body.timestamp).toBe('string');
      expect(typeof body.uptime).toBe('number');
    });
  });

  // -------------------------------------------------------------------------
  // Case 4 — Timeout: $queryRaw never resolves
  // -------------------------------------------------------------------------
  describe('when DB query times out', () => {
    it('throws HttpException 503 with error "timeout" and latencyMs null', async () => {
      setAllDrivers(undefined);
      process.env.MATCH_REPOSITORY_DRIVER = 'prisma';

      // $queryRaw returns a promise that never resolves
      const neverResolves = new Promise<never>(() => {});
      prisma = makePrisma(() => neverResolves);
      service = new HealthService(prisma);

      const checkPromise = service.check();

      // Advance fake timers past the 3000ms timeout inside the service
      jest.runAllTimers();

      let caught: unknown;
      try {
        await checkPromise;
      } catch (err: unknown) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(HttpException);
      const httpErr = caught as HttpException;
      expect(httpErr.getStatus()).toBe(503);

      const body = httpErr.getResponse() as Record<string, unknown>;
      expect(body.status).toBe('error');

      const db = body.db as Record<string, unknown>;
      expect(db.status).toBe('error');
      expect(db.error).toBe('timeout');
      expect(db.latencyMs).toBeNull();
    });
  });
});
