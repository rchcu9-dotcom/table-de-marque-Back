import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { MatchModule } from '@/infrastructure/http/match/match.module';
import {
  MATCH_REPOSITORY_SOURCE,
  MatchRepository,
} from '@/domain/match/repositories/match.repository';
import { Match } from '@/domain/match/entities/match.entity';

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

describe('Match polling (e2e)', () => {
  let app: INestApplication;
  let repository: RotatingMatchRepository;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    process.env.MATCH_CACHE_REFRESH_MS = '50';
    process.env.MATCH_CACHE_POLLING_ENABLED = 'true';
    process.env.GOOGLE_SHEETS_CLASSEMENT_CSV_URL = 'mock://classement';

    repository = new RotatingMatchRepository([
      [new Match('1', new Date('2024-01-01T10:00:00Z'), 'Team A1', 'Team B', 'planned')],
      [new Match('1', new Date('2024-01-01T10:00:00Z'), 'Team A2', 'Team B', 'planned')],
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

  it('refreshes the cache via polling and serves updated data', async () => {
    const res1 = await request(app.getHttpServer()).get('/matches').expect(200);
    expect(res1.body[0].teamA).toBe('Team A1');

    repository.cursor = 1;
    await new Promise((resolve) => setTimeout(resolve, 120));

    const res2 = await request(app.getHttpServer()).get('/matches').expect(200);
    expect(res2.body[0].teamA).toBe('Team A2');
  });
});
