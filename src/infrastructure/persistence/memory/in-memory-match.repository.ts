import { Injectable } from '@nestjs/common';
import { Match } from '@/domain/match/entities/match.entity';
import { MatchRepository } from '@/domain/match/repositories/match.repository';

@Injectable()
export class InMemoryMatchRepository implements MatchRepository {
  private items: Match[] = [];

  async create(match: Match): Promise<Match> {
    this.items.push(match);
    return match;
  }

  async findAll(): Promise<Match[]> {
    // On renvoie une copie pour éviter les mutations externes
    return [...this.items];
  }

  async findById(id: string): Promise<Match | null> {
    return this.items.find((m) => m.id === id) ?? null;
  }

  async update(match: Match): Promise<Match> {
    const index = this.items.findIndex((m) => m.id === match.id);
    if (index === -1) {
      this.items.push(match);
      return match;
    }

    this.items[index] = match;
    return match;
  }

  async delete(id: string): Promise<void> {
    this.items = this.items.filter((m) => m.id !== id);
  }

    /** ⚠️ Utilisé uniquement dans les tests E2E/unitaires pour repartir d'un état propre */
  clear() {
    this.items = [];
  }
}
