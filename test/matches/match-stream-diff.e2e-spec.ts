import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { firstValueFrom, take } from 'rxjs';

import { Match } from '@/domain/match/entities/match.entity';
import {
  MATCH_REPOSITORY_SOURCE,
  MatchRepository,
} from '@/domain/match/repositories/match.repository';
import { MatchStreamService } from '@/hooks/match-stream.service';
import { MatchCacheService } from '@/infrastructure/persistence/match-cache.service';
import { MatchModule } from '@/infrastructure/http/match/match.module';

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

describe('Match stream emits on sheet change (mocked)', () => {
  let app: INestApplication;
  let repository: RotatingMatchRepository;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    process.env.MATCH_CACHE_POLLING_ENABLED = 'false';
    process.env.GOOGLE_SHEETS_CLASSEMENT_CSV_URL = 'mock://classement';

    repository = new RotatingMatchRepository([
      [new Match('1', new Date('2024-01-01T10:00:00Z'), 'Team A', 'Team B', 'ongoing', 0, 0)],
      [new Match('1', new Date('2024-01-01T10:00:00Z'), 'Team A', 'Team B', 'ongoing', 1, 0)],
    ]);

    const moduleRef = await Test.createTestingModule({
      imports: [MatchModule],
    })
      .overrideProvider(MATCH_REPOSITORY_SOURCE)
      .useValue(repository)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    process.env = { ...originalEnv };
  });

  it('émet un event avec diff lorsque les données changent', async () => {
    const cache = app.get(MatchCacheService);
    const stream = app.get(MatchStreamService);

    // seed initial cache
    await cache.refresh(true);

    // écouter le prochain event
    const nextEvent = firstValueFrom(stream.observe().pipe(take(1)));

    // simuler une nouvelle "sheet" en changeant le snapshot
    repository.cursor = 1;
    await cache.refresh(true);

    const event = await nextEvent;
    expect(event.type).toBe('matches');
    expect(event.diff.updated).toContain('1');
    expect(event.matches[0].scoreA).toBe(1);
    expect(event.matches[0].scoreB).toBe(0);
  });
});
