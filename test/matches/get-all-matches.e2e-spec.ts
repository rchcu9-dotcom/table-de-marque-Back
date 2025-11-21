import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { MatchModule } from '@/infrastructure/http/match/match.module';
import { MATCH_REPOSITORY } from '@/domain/match/repositories/match.repository';
import { MatchRepository } from '@/domain/match/repositories/match.repository';
import { Match } from '@/domain/match/entities/match.entity';

class InMemoryMatchRepository implements MatchRepository {
  public items: Match[] = [];

  async create(match: Match): Promise<Match> {
    this.items.push(match);
    return match;
  }
  async findAll(): Promise<Match[]> {
    return this.items;
  }
  async update(match: Match): Promise<Match> {
    const index = this.items.findIndex(m => m.id === match.id);
    if (index !== -1) this.items[index] = match;
    return match;
  }
}

describe('GET /matches (e2e)', () => {
  let app: INestApplication;
  let repo: InMemoryMatchRepository;

  beforeAll(async () => {
    repo = new InMemoryMatchRepository();

    // pré-remplissage
    await repo.create(new Match('1', new Date(), 'A', 'B', 'planned'));

    const moduleRef = await Test.createTestingModule({
      imports: [MatchModule],
    })
      .overrideProvider(MATCH_REPOSITORY)
      .useValue(repo)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  it('should return all matches', async () => {
    const res = await request(app.getHttpServer())
      .get('/matches')
      .expect(200);

    expect(res.body.length).toBe(1);
  });

  afterAll(async () => {
    await app.close();
  });
});
