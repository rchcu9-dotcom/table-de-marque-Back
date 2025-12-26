import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { MatchModule } from '@/infrastructure/http/match/match.module';
import { MATCH_REPOSITORY } from '@/domain/match/repositories/match.repository';
import { InMemoryMatchRepository } from '@/infrastructure/persistence/memory/in-memory-match.repository';
import { Match } from '@/domain/match/entities/match.entity';

describe('DELETE /matches/:id (e2e)', () => {
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
    // Reset propre du repository entre les tests
    repository.clear();

    // Pré-remplissage : un match à supprimer
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

  it('should delete a match and return updated metadata', async () => {
    const payload = {
      reason: 'mistake',
      deletedBy: 'referee',
    };

    const res = await request(app.getHttpServer())
      .delete('/matches/abc')
      .send(payload)
      .expect(200);

    // Vérification de la réponse HTTP
    expect(res.body.id).toBe('abc');
    expect(res.body.status).toBe('deleted');
  });

  afterAll(async () => {
    await app.close();
    process.env = { ...originalEnv };
    global.fetch = originalFetch as any;
  });
});
