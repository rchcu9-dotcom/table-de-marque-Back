/* eslint-disable @typescript-eslint/require-await */
import { Injectable } from '@nestjs/common';
import { Joueur } from '@/domain/joueur/entities/joueur.entity';
import { JoueurRepository } from '@/domain/joueur/repositories/joueur.repository';

@Injectable()
export class InMemoryJoueurRepository implements JoueurRepository {
  private items: Joueur[] = [];

  async create(joueur: Joueur): Promise<Joueur> {
    this.items.push(joueur);
    return joueur;
  }

  async findAll(): Promise<Joueur[]> {
    return [...this.items];
  }

  async findById(id: string): Promise<Joueur | null> {
    return this.items.find((j) => j.id === id) ?? null;
  }

  async findByEquipe(equipeId: string): Promise<Joueur[]> {
    const needle = equipeId.trim().toLowerCase();
    return this.items.filter(
      (j) => (j.equipeId ?? '').trim().toLowerCase() === needle,
    );
  }

  async update(joueur: Joueur): Promise<Joueur> {
    const idx = this.items.findIndex((j) => j.id === joueur.id);
    if (idx === -1) {
      this.items.push(joueur);
      return joueur;
    }
    this.items[idx] = joueur;
    return joueur;
  }

  async delete(id: string): Promise<void> {
    this.items = this.items.filter((j) => j.id !== id);
  }

  /** Utilitaire de test pour repartir d'un état propre. */
  clear() {
    this.items = [];
  }
}
