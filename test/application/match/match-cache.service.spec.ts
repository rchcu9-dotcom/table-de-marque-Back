import { Match } from '@/domain/match/entities/match.entity';
import { MatchRepository } from '@/domain/match/repositories/match.repository';
import { MatchCacheService } from '@/infrastructure/persistence/match-cache.service';
import { MatchStreamService } from '@/hooks/match-stream.service';

class FakeMatchRepository implements MatchRepository {
  calls = 0;
  snapshots: Match[][];
  cursor = 0;

  constructor(snapshots: Match[][]) {
    this.snapshots = snapshots;
  }

  async findAll(): Promise<Match[]> {
    this.calls += 1;
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

describe('MatchCacheService', () => {
  const now = new Date('2024-01-01T10:00:00Z');
  const later = new Date('2024-01-01T11:00:00Z');

  const snapshots: Match[][] = [
    [new Match('1', now, 'Team A', 'Team B', 'planned', null, null)],
    [new Match('1', later, 'Team A', 'Team B', 'finished', 3, 2)],
  ];

  it('hydrates the cache on first call and avoids duplicate fetches when unchanged', async () => {
    const fakeRepo = new FakeMatchRepository(snapshots);
    const cache = new MatchCacheService(fakeRepo as unknown as MatchRepository, new MatchStreamService());

    const first = await cache.findAll();
    expect(first).toHaveLength(1);
    expect(fakeRepo.calls).toBe(1);

    const second = await cache.findAll();
    expect(second[0].teamA).toBe('Team A');
    expect(fakeRepo.calls).toBe(1); // served from cache

    const diff = await cache.refresh();
    expect(diff.changed).toBe(false);
    expect(fakeRepo.calls).toBe(2); // refresh reads source once more
  });

  it('detects added/updated matches and updates metadata', async () => {
    const fakeRepo = new FakeMatchRepository(snapshots);
    const stream = new MatchStreamService();
    const cache = new MatchCacheService(fakeRepo as unknown as MatchRepository, stream);

    await cache.refresh(true);
    expect(cache.getMetadata().cacheSize).toBe(1);

    fakeRepo.cursor = 1; // move to updated snapshot
    const events: any[] = [];
    stream.observe({ replayLast: true }).subscribe((e) => events.push(e));

    const diff = await cache.refresh();

    expect(diff.changed).toBe(true);
    expect(diff.updated).toContain('1');
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(cache.getMetadata().cacheSize).toBe(1);

    const match = await cache.findById('1');
    expect(match?.status).toBe('finished');
    expect(match?.scoreA).toBe(3);
    expect(events.length).toBeGreaterThan(0);
    expect(events[events.length - 1].diff.updated).toContain('1');
  });
});
