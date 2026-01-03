/* eslint-disable @typescript-eslint/require-await */
import {
  Equipe,
  PouleClassement,
  PouleCode,
} from '@/domain/equipe/entities/equipe.entity';
import { EquipeRepository } from '@/domain/equipe/repositories/equipe.repository';

export class InMemoryEquipeRepository implements EquipeRepository {
  private poules: Map<string, PouleClassement> = new Map();
  private equipes: Equipe[] = [];

  private normalize(key: string): string {
    return (key ?? '').trim().toLowerCase();
  }

  clear() {
    this.poules.clear();
    this.equipes = [];
  }

  setData(poules: PouleClassement[]) {
    this.clear();
    for (const poule of poules) {
      const normalizedCode = this.normalize(String(poule.pouleCode));
      const clonedEquipes = poule.equipes.map(
        (eq) =>
          new Equipe(
            eq.id,
            eq.name,
            eq.logoUrl ?? null,
            eq.pouleCode,
            eq.pouleName,
            eq.rang,
            eq.joues,
            eq.victoires,
            eq.nuls,
            eq.defaites,
            eq.points,
            eq.bp,
            eq.bc,
            eq.diff,
          ),
      );
      const clonedPoule: PouleClassement = {
        pouleCode: poule.pouleCode,
        pouleName: poule.pouleName,
        phase: poule.phase,
        equipes: clonedEquipes,
      };
      this.poules.set(normalizedCode, clonedPoule);
      this.equipes.push(...clonedEquipes);
    }
  }

  async findClassementByPoule(
    code: PouleCode,
  ): Promise<PouleClassement | null> {
    const normalized = this.normalize(String(code));
    return this.poules.get(normalized) ?? null;
  }

  async findClassementByTeamName(
    teamName: string,
  ): Promise<PouleClassement | null> {
    const target = this.normalize(teamName);
    for (const poule of this.poules.values()) {
      if (
        poule.equipes.some(
          (eq) =>
            this.normalize(eq.name) === target ||
            this.normalize(eq.id) === target,
        )
      ) {
        return poule;
      }
    }
    return null;
  }

  async findAllEquipes(): Promise<Equipe[]> {
    return [...this.equipes];
  }

  async findEquipeById(id: string): Promise<Equipe | null> {
    const target = this.normalize(id);
    return (
      this.equipes.find(
        (eq) =>
          this.normalize(eq.id) === target ||
          this.normalize(eq.name) === target ||
          this.normalize(eq.pouleCode) === target,
      ) ?? null
    );
  }
}
