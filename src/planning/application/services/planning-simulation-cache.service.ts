import { Injectable } from '@nestjs/common';
import { SimulationResult } from '../../domain/entities/simulation-result.entity';

/**
 * Cache mémoire transitoire, jamais persisté (D14, cf. track de la spec).
 * Un seul slot par édition : relancer une simulation remplace simplement la
 * précédente (§3 de la spec). Perdu au redémarrage du process — acceptable,
 * une simulation non confirmée n'a aucune valeur à conserver au-delà de la
 * session de réglage en cours.
 */
@Injectable()
export class PlanningSimulationCacheService {
  private readonly parEdition = new Map<number, SimulationResult>();

  set(editionId: number, result: SimulationResult): void {
    this.parEdition.set(editionId, result);
  }

  get(editionId: number): SimulationResult | null {
    return this.parEdition.get(editionId) ?? null;
  }

  getById(editionId: number, simulationId: string): SimulationResult | null {
    const current = this.get(editionId);
    if (!current || current.id !== simulationId) return null;
    return current;
  }

  clear(editionId: number): void {
    this.parEdition.delete(editionId);
  }
}
