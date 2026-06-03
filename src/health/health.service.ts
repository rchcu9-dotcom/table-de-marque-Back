import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/persistence/mysql/prisma.service';

export const DRIVERS_ENV_KEYS = [
  'MATCH_REPOSITORY_DRIVER',
  'EQUIPE_REPOSITORY_DRIVER',
  'JOUEUR_REPOSITORY_DRIVER',
  'ATELIER_REPOSITORY_DRIVER',
  'TENTATIVE_ATELIER_REPOSITORY_DRIVER',
] as const;

const DB_TIMEOUT_MS = 3000;

export interface HealthPayload {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  db: DbStatus;
}

interface DbStatus {
  status: 'ok' | 'not_configured' | 'error';
  latencyMs: number | null;
  error?: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthPayload> {
    const version = process.env.npm_package_version ?? 'unknown';
    const environment = process.env.NODE_ENV ?? 'development';
    const timestamp = new Date().toISOString();
    const uptime = process.uptime();

    const isPrismaDriver = DRIVERS_ENV_KEYS.some(
      (key) => (process.env[key] ?? '').trim().toLowerCase() === 'prisma',
    );

    if (!isPrismaDriver) {
      return {
        status: 'degraded',
        timestamp,
        uptime,
        version,
        environment,
        db: { status: 'not_configured', latencyMs: null },
      };
    }

    const start = Date.now();
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), DB_TIMEOUT_MS),
        ),
      ]);
      const latencyMs = Date.now() - start;

      if (latencyMs > DB_TIMEOUT_MS) {
        const payload = {
          status: 'error' as const,
          timestamp,
          uptime,
          version,
          environment,
          db: { status: 'error' as const, latencyMs, error: 'timeout' },
        };
        throw new HttpException(payload, 503);
      }

      return {
        status: 'ok',
        timestamp,
        uptime,
        version,
        environment,
        db: { status: 'ok', latencyMs },
      };
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        throw err;
      }
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      const isTimeout = message === 'timeout';
      const payload = {
        status: 'error' as const,
        timestamp,
        uptime,
        version,
        environment,
        db: {
          status: 'error' as const,
          latencyMs: isTimeout ? null : latencyMs,
          error: message,
        },
      };
      throw new HttpException(payload, 503);
    }
  }
}
