/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { Atelier } from '@/domain/challenge/entities/atelier.entity';
import { AtelierRepository } from '@/domain/challenge/repositories/atelier.repository';

@Injectable()
export class InMemoryAtelierRepository implements AtelierRepository {
  private items: Atelier[] = [];

  async seed(ateliers: Atelier[]): Promise<void> {
    this.items = [...ateliers];
  }

  async findAll(): Promise<Atelier[]> {
    return [...this.items];
  }

  async findById(id: string): Promise<Atelier | null> {
    return this.items.find((a) => a.id === id) ?? null;
  }
}
