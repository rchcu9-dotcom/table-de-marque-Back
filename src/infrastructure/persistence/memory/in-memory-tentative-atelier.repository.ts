import { Injectable } from '@nestjs/common';
import { TentativeAtelier } from '@/domain/challenge/entities/tentative-atelier.entity';
import { TentativeAtelierRepository } from '@/domain/challenge/repositories/tentative-atelier.repository';

@Injectable()
export class InMemoryTentativeAtelierRepository implements TentativeAtelierRepository {
  private items: TentativeAtelier[] = [];

  async create(tentative: TentativeAtelier): Promise<TentativeAtelier> {
    this.items.push(tentative);
    return tentative;
  }

  async findByAtelier(atelierId: string): Promise<TentativeAtelier[]> {
    return this.items.filter((t) => t.atelierId === atelierId);
  }

  async findAll(): Promise<TentativeAtelier[]> {
    return [...this.items];
  }

  async clear(): Promise<void> {
    this.items = [];
  }
}
