import { Injectable } from '@nestjs/common';
import { Match } from '@/domain/match/entities/match.entity';
import { MatchRepository } from '@/domain/match/repositories/match.repository';

@Injectable()
export class InMemoryMatchRepository implements MatchRepository {
  private items: Match[] = [];

  create(match: Match): Promise<Match> {
    this.items.push(match);
    return Promise.resolve(match);
  }

  findAll(): Promise<Match[]> {
    // On renvoie une copie pour éviter les mutations externes
    return Promise.resolve([...this.items]);
  }

  findById(id: string): Promise<Match | null> {
    return Promise.resolve(this.items.find((m) => m.id === id) ?? null);
  }

  update(match: Match): Promise<Match> {
    const index = this.items.findIndex((m) => m.id === match.id);
    if (index === -1) {
      this.items.push(match);
      return Promise.resolve(match);
    }

    this.items[index] = match;
    return Promise.resolve(match);
  }

  delete(id: string): Promise<void> {
    this.items = this.items.filter((m) => m.id !== id);
    return Promise.resolve();
  }

  // Utilisé uniquement dans les tests E2E/unitaires pour repartir d'un état propre
  clear() {
    this.items = [];
  }
}
