import { Injectable } from '@nestjs/common';
import { Atelier } from '@/domain/challenge/entities/atelier.entity';
import { AtelierRepository } from '@/domain/challenge/repositories/atelier.repository';

@Injectable()
export class MySqlAtelierRepository implements AtelierRepository {
  async findAll(): Promise<Atelier[]> {
    return [
      new Atelier('atelier-vitesse', 'Vitesse (qualifs)', 'vitesse', 'Jour 1 - PG', 1),
      new Atelier('atelier-tir', 'Adresse au tir', 'tir', 'Jour 1 - PG', 2),
      new Atelier('atelier-glisse', 'Glisse & Crosse', 'glisse_crosse', 'Jour 1 - PG', 3),
      new Atelier('finale-vitesse-qf', 'Finale Vitesse - Quarts', 'vitesse', 'Jour 3 - GG Surf #1', 4),
      new Atelier('finale-vitesse-df', 'Finale Vitesse - Demis', 'vitesse', 'Jour 3 - GG Surf #2', 5),
      new Atelier('finale-vitesse-finale', 'Finale Vitesse - Finale', 'vitesse', 'Jour 3 - GG Surf #3', 6),
    ];
  }

  async findById(id: string): Promise<Atelier | null> {
    const all = await this.findAll();
    return all.find((a) => a.id === id) ?? null;
  }

  async seed(_ateliers: Atelier[]): Promise<void> {
    throw new Error('MySQL repository is read-only.');
  }
}
