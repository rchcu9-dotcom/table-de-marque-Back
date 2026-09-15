import { Injectable } from '@nestjs/common';
import { InscriptionStatut } from '@prisma/client';
import { PlanningPrismaService } from '../../infrastructure/persistence/planning-prisma.service';
import { EquipeSimulation } from '../../domain/entities/equipe-simulation.entity';

const STATUTS_ENGAGES: InscriptionStatut[] = [
  InscriptionStatut.VALIDEE,
  InscriptionStatut.DOSSIER_EN_COURS,
  InscriptionStatut.DOSSIER_COMPLET,
];

export type ResolutionEquipes = {
  equipes: EquipeSimulation[];
  nbReel: number;
  nbFictif: number;
};

@Injectable()
export class EquipesSimulationService {
  constructor(private readonly prisma: PlanningPrismaService) {}

  /**
   * Équipes réelles engagées (inscription acceptée ET déjà synchronisée côté
   * ta_equipes via equipeRefId) + complément fictif en mémoire jusqu'à la
   * cible. Une inscription acceptée mais pas encore synchronisée est traitée
   * comme une équipe manquante ordinaire (§4 de la spec) — pas de logique
   * dédiée.
   */
  async resoudre(
    editionId: number,
    nbEquipesCible: number,
  ): Promise<ResolutionEquipes> {
    const inscriptions = await this.prisma.inscInscription.findMany({
      where: {
        editionId,
        statut: { in: STATUTS_ENGAGES },
        equipeRefId: { not: null },
      },
      select: { equipeRefId: true, equipeNom: true },
    });

    const equipeRefIds = inscriptions
      .map((i) => i.equipeRefId)
      .filter((id): id is number => id != null);

    const taEquipes = equipeRefIds.length
      ? await this.prisma.taEquipe.findMany({
          where: { equipeRefId: { in: equipeRefIds } },
          select: { id: true, equipe: true, equipeRefId: true },
        })
      : [];

    const equipesReelles: EquipeSimulation[] = taEquipes.map(
      (ta) => new EquipeSimulation(`real:${ta.id}`, ta.equipe, false, ta.id),
    );

    const nbFictif = Math.max(0, nbEquipesCible - equipesReelles.length);
    const equipesFictives: EquipeSimulation[] = Array.from(
      { length: nbFictif },
      (_, i) =>
        new EquipeSimulation(`fictive:${i + 1}`, `Équipe ${i + 1}`, true, null),
    );

    return {
      equipes: [...equipesReelles, ...equipesFictives],
      nbReel: equipesReelles.length,
      nbFictif,
    };
  }
}
