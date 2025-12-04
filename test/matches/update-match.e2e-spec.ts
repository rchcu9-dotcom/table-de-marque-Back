import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { MatchModule } from '@/infrastructure/http/match/match.module';
import { MATCH_REPOSITORY } from '@/domain/match/repositories/match.repository';
import { InMemoryMatchRepository } from '@/infrastructure/persistence/memory/in-memory-match.repository';
import { Match } from '@/domain/match/entities/match.entity';

describe('PUT /matches/:id (e2e)', () => {
  let app: INestApplication;
  let repository: InMemoryMatchRepository;
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeAll(async () => {
    process.env.GOOGLE_SHEETS_CLASSEMENT_CSV_URL = 'mock://classement';
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    });

    repository = new InMemoryMatchRepository();

    const moduleRef = await Test.createTestingModule({
      imports: [MatchModule],
    })
      .overrideProvider(MATCH_REPOSITORY)
      .useValue(repository)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    repository.clear();

    repository.create(
      new Match(
        'abc',
        new Date('2025-01-01T10:00:00Z'),
        'A',
        'B',
        'planned',
      ),
    );
  });

  it('should update a match', async () => {
    const payload = {
      date: '2025-02-01T12:00:00Z',
      teamA: 'Paris',
      teamB: 'Nice',
      status: 'ongoing',
    };

    const res = await request(app.getHttpServer())
      .put('/matches/abc')
      .send(payload)
      .expect(200);

    expect(res.body.id).toBe('abc');
    expect(res.body.teamA).toBe('Paris');
    expect(res.body.teamB).toBe('Nice');
    expect(res.body.status).toBe('ongoing');
  });

  afterAll(async () => {
    await app.close();
    process.env = { ...originalEnv };
    global.fetch = originalFetch as any;
  });
});
