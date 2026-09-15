import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PlanningSimulationCacheService } from '../services/planning-simulation-cache.service';
import {
  PlanningMatchWriter,
  PLANNING_MATCH_WRITER,
} from '../../domain/repositories/planning-match-writer.repository';
import {
  CreneauActiviteRepository,
  CRENEAU_ACTIVITE_REPOSITORY,
} from '../../domain/repositories/creneau-activite.repository';
import {
  PlanningConfirmationRepository,
  PLANNING_CONFIRMATION_REPOSITORY,
} from '../../domain/repositories/planning-confirmation.repository';
import { ConfirmerPlanningDto } from '../dto/confirmer-planning.dto';

export type ConfirmerPlanningResult = {
  nbMatchsCrees: number;
  nbActivitesCrees: number;
};

@Injectable()
export class ConfirmerPlanningUseCase {
  constructor(
    private readonly cache: PlanningSimulationCacheService,
    @Inject(PLANNING_MATCH_WRITER)
    private readonly matchWriter: PlanningMatchWriter,
    @Inject(CRENEAU_ACTIVITE_REPOSITORY)
    private readonly creneauActiviteRepository: CreneauActiviteRepository,
    @Inject(PLANNING_CONFIRMATION_REPOSITORY)
    private readonly confirmationRepository: PlanningConfirmationRepository,
  ) {}

  async execute(
    editionId: number,
    dto: ConfirmerPlanningDto,
  ): Promise<ConfirmerPlanningResult> {
    const simulation = this.cache.get(editionId);
    if (!simulation) {
      throw new NotFoundException(
        'Aucune simulation en cours pour cette édition — relancer POST /simuler avant de confirmer',
      );
    }

    const forcer = dto.forcerEquipesFictives ?? false;
    const nbFictives = simulation.equipes.filter((e) => e.fictive).length;
    if (nbFictives > 0 && !forcer) {
      throw new BadRequestException(
        `${nbFictives} équipe(s) fictive(s) présente(s) — confirmation bloquée sauf forcerEquipesFictives=true`,
      );
    }

    const equipeIdByRef = new Map(
      simulation.equipes
        .filter((e) => e.equipeId != null)
        .map((e) => [e.ref, e.equipeId as number]),
    );

    const nbMatchsCrees = await this.matchWriter.ecrireMatchs(
      simulation.matches,
      equipeIdByRef,
      editionId,
    );
    const assignations = simulation.activites.map((a) => {
      const equipeId = equipeIdByRef.get(a.equipeRef) ?? null;
      return {
        creneauId: a.creneauId,
        equipeId,
        equipeLabel: equipeId == null ? a.equipeNom : null,
      };
    });
    const creneauxConfirmes =
      await this.creneauActiviteRepository.assignerEquipes(
        editionId,
        assignations,
      );

    await this.confirmationRepository.record({
      editionId,
      nbMatchsCrees,
      nbActivitesCrees: creneauxConfirmes.length,
      forcageEquipesFictives: forcer && nbFictives > 0,
    });

    this.cache.clear(editionId);

    return { nbMatchsCrees, nbActivitesCrees: creneauxConfirmes.length };
  }
}
