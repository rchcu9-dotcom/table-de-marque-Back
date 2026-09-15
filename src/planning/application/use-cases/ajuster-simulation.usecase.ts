import { Injectable, NotFoundException } from '@nestjs/common';
import { PlanningSimulationCacheService } from '../services/planning-simulation-cache.service';
import { VerificationPlanningService } from '../services/verification-planning.service';
import { AjusterSimulationDto } from '../dto/ajuster-simulation.dto';
import { SimulationResult } from '../../domain/entities/simulation-result.entity';
import { MatchGenere } from '../../domain/entities/match-genere.entity';
import { DEFAULT_NB_PATINOIRES } from '../services/default-parametres';

/**
 * Ajustement manuel avant confirmation — marqué "(optionnel)" au §8 de la
 * spec. Mutation ponctuelle du cache + re-vérification seule, sans
 * ré-optimisation du placement repas/challenge (hors périmètre de cette
 * fonctionnalité annexe).
 */
@Injectable()
export class AjusterSimulationUseCase {
  constructor(
    private readonly cache: PlanningSimulationCacheService,
    private readonly verificationPlanning: VerificationPlanningService,
  ) {}

  execute(
    editionId: number,
    simulationId: string,
    numMatch: number,
    dto: AjusterSimulationDto,
  ): SimulationResult {
    const simulation = this.cache.getById(editionId, simulationId);
    if (!simulation) {
      throw new NotFoundException(
        `Simulation ${simulationId} introuvable ou remplacée par une simulation plus récente`,
      );
    }

    const index = simulation.matches.findIndex((m) => m.numMatch === numMatch);
    if (index === -1) {
      throw new NotFoundException(
        `Match ${numMatch} introuvable dans cette simulation`,
      );
    }

    const original = simulation.matches[index];
    const equipeParRef = new Map(simulation.equipes.map((e) => [e.ref, e]));
    const nomDe = (ref?: string, fallback?: string) =>
      ref ? (equipeParRef.get(ref)?.nom ?? fallback ?? ref) : fallback;

    const ajuste = new MatchGenere(
      original.numMatch,
      original.jour,
      original.matchCase,
      dto.equipe1Ref ?? original.equipe1Ref,
      nomDe(dto.equipe1Ref, original.equipe1Nom)!,
      dto.equipe2Ref ?? original.equipe2Ref,
      nomDe(dto.equipe2Ref, original.equipe2Nom)!,
      dto.dateHeure ?? original.dateHeure,
      dto.dureeMin ?? original.dureeMin,
      original.is3v3,
      original.poule,
      original.phase,
    );

    const matches = [...simulation.matches];
    matches[index] = ajuste;

    const violations = this.verificationPlanning.verifier({
      matches,
      activites: simulation.activites,
      jours: [], // la vérification horaire par jour est secondaire pour un ajustement ponctuel
      delaiMinActivite: null,
      nbPatinoires: DEFAULT_NB_PATINOIRES,
      equipes: simulation.equipes,
    });

    const misAJour = new SimulationResult(
      simulation.id,
      simulation.editionId,
      simulation.generatedAt,
      simulation.score,
      violations,
      simulation.equipes,
      matches,
      simulation.activites,
      simulation.mode,
    );

    this.cache.set(editionId, misAJour);
    return misAJour;
  }
}
