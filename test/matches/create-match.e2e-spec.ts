import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { MatchModule } from '@/infrastructure/http/match/match.module';
import { MATCH_REPOSITORY } from '@/domain/match/repositories/match.repository';
import { InMemoryMatchRepository } from '@/infrastructure/persistence/memory/in-memory-match.repository';

describe('POST /matches (e2e)', () => {
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
    // Reset entre chaque test
    repository.clear();
  });

  it('should create a match', async () => {
    const payload = {
      date: '2025-01-01T10:00:00Z',
      teamA: 'Lyon',
      teamB: 'Grenoble',
    };

    const res = await request(app.getHttpServer())
      .post('/matches')
      .send(payload)
      .expect(201);

    // Vérifie la réponse HTTP
    expect(res.body.id).toBeDefined();
    expect(res.body.teamA).toBe('Lyon');
    expect(res.body.teamB).toBe('Grenoble');

    // Vérifie que le repository contient bien 1 match
    expect(repository.findAll().then(m => m.length)).resolves.toBe(1);
  });

  afterAll(async () => {
    await app.close();
    process.env = { ...originalEnv };
    global.fetch = originalFetch as any;
  });
});
