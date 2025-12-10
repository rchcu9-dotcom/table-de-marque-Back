import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { MatchModule } from '@/infrastructure/http/match/match.module';
import {
  MATCH_REPOSITORY_SOURCE,
  MatchRepository,
} from '@/domain/match/repositories/match.repository';
import { Match } from '@/domain/match/entities/match.entity';
import { MatchCacheService } from '@/infrastructure/persistence/match-cache.service';
import { MatchStreamService } from '@/hooks/match-stream.service';

class RotatingMatchRepository implements MatchRepository {
  constructor(private readonly snapshots: Match[][]) {}
  cursor = 0;

  async findAll(): Promise<Match[]> {
    return this.snapshots[this.cursor].map(
      (m) =>
        new Match(
          m.id,
          new Date(m.date),
          m.teamA,
          m.teamB,
          m.status,
          m.scoreA,
          m.scoreB,
        ),
    );
  }

  async findById(_id: string): Promise<Match | null> {
    return null;
  }

  async create(_match: Match): Promise<Match> {
    throw new Error('not implemented');
  }

  async update(_match: Match): Promise<Match> {
    throw new Error('not implemented');
  }

  async delete(_id: string): Promise<void> {
    return;
  }
}

describe('GET /matches/stream (SSE)', () => {
  let app: INestApplication;
  let repository: RotatingMatchRepository;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    process.env.MATCH_CACHE_POLLING_ENABLED = 'true';
    process.env.MATCH_CACHE_REFRESH_MS = '20';
    process.env.GOOGLE_SHEETS_CLASSEMENT_CSV_URL = 'mock://classement';

    repository = new RotatingMatchRepository([
      [new Match('1', new Date('2024-01-01T10:00:00Z'), 'Team A1', 'Team B', 'planned')],
    ]);

    const moduleRef = await Test.createTestingModule({
      imports: [MatchModule],
    })
      .overrideProvider(MATCH_REPOSITORY_SOURCE)
      .useValue(repository)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    // Ensure an initial refresh to seed the stream
    const cache = app.get(MatchCacheService);
    await cache.refresh(true);
  });

  afterAll(async () => {
    await app.close();
    process.env = { ...originalEnv };
  });

  it('pushes events on the stream service when refreshed', async () => {
    const stream = app.get(MatchStreamService);
    const cache = app.get(MatchCacheService);

    const promise = new Promise<any>((resolve) => {
      stream.observe({ replayLast: true, completeAfterFirst: true }).subscribe((event) => {
        resolve(event);
      });
    });

    repository.cursor = 0;
    await cache.refresh(true);

    const event = await promise;
    expect(event.type).toBe('matches');
    expect(event.matches[0].teamA).toBe('Team A1');
  });
});
