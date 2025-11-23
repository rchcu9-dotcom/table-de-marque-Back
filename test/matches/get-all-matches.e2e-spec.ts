import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { MatchModule } from '@/infrastructure/http/match/match.module';
import { MATCH_REPOSITORY } from '@/domain/match/repositories/match.repository';
import { InMemoryMatchRepository } from '@/infrastructure/persistence/memory/in-memory-match.repository';
import { Match } from '@/domain/match/entities/match.entity';

describe('GET /matches (e2e)', () => {
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
    // Reset entre chaque test
    repository.clear();

    // Pré-remplissage
    repository.create(
      new Match(
        '1',
        new Date(),
        'A',
        'B',
        'planned',
      ),
    );
  });

  it('should return all matches', async () => {
    const res = await request(app.getHttpServer())
      .get('/matches')
      .expect(200);

    expect(res.body.length).toBe(1);
    expect(res.body[0].teamA).toBe('A');
  });

  afterAll(async () => {
    await app.close();
  });
});
