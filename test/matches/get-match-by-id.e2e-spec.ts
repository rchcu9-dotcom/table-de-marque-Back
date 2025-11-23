import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { MatchModule } from '@/infrastructure/http/match/match.module';
import { MATCH_REPOSITORY } from '@/domain/match/repositories/match.repository';
import { InMemoryMatchRepository } from '@/infrastructure/persistence/memory/in-memory-match.repository';
import { Match } from '@/domain/match/entities/match.entity';

describe('GET /matches/:id (e2e)', () => {
  let app: INestApplication;
  let repository: InMemoryMatchRepository;

  beforeAll(async () => {
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
        new Date(),
        'A',
        'B',
        'planned',
      ),
    );
  });

  it('should return a match by id', async () => {
    const res = await request(app.getHttpServer())
      .get('/matches/abc')
      .expect(200);

    expect(res.body.id).toBe('abc');
    expect(res.body.teamA).toBe('A');
    expect(res.body.teamB).toBe('B');
  });

  afterAll(async () => {
    await app.close();
  });
});
