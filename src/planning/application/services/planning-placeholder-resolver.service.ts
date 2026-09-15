import { Inject, Injectable, Logger } from '@nestjs/common';
import { Equipe } from '@/domain/equipe/entities/equipe.entity';
import {
  EQUIPE_REPOSITORY,
  EquipeRepository,
} from '@/domain/equipe/repositories/equipe.repository';
import {
  MATCH_LIVE_REPOSITORY,
  MatchLiveRepository,
} from '@/table-de-marque/domain/repositories/match-live.repository';
import { MatchLiveEtat } from '@/table-de-marque/domain/enums/match-live-etat.enum';
import { PlanningMatchSlot } from '../../domain/entities/planning-match-slot.entity';
import {
  PLANNING_MATCH_SLOT_REPOSITORY,
  PlanningMatchSlotRepository,
} from '../../domain/repositories/planning-match-slot.repository';
import {
  PLANNING_MATCH_WRITER,
  PlanningMatchWriter,
} from '../../domain/repositories/planning-match-writer.repository';

export type ResolutionResult =
  | {
      slot: PlanningMatchSlot;
      ambigu: false;
      equipeId: number;
      equipeNom: string;
    }
  | { slot: PlanningMatchSlot; ambigu: true; raison: string };

@Injectable()
export class PlanningPlaceholderResolverService {
  private readonly logger = new Logger(PlanningPlaceholderResolverService.name);

  constructor(
    @Inject(PLANNING_MATCH_SLOT_REPOSITORY)
    private readonly slotRepo: PlanningMatchSlotRepository,
    @Inject(PLANNING_MATCH_WRITER)
    private readonly matchWriter: PlanningMatchWriter,
    @Inject(EQUIPE_REPOSITORY)
    private readonly equipeRepo: EquipeRepository,
    @Inject(MATCH_LIVE_REPOSITORY)
    private readonly matchLiveRepo: MatchLiveRepository,
  ) {}

  /**
   * Résolution par confrontation directe (spec §3a, §4) : un match de
   * bracket vient de passer TERMINE, résout tout slot `vainqueur-*` qui en
   * dépend (`numMatchSource === numMatchTermine`).
   */
  async resoudreParConfrontation(
    numMatchTermine: number,
  ): Promise<ResolutionResult[]> {
    const slots = await this.slotRepo.findByNumMatchSource(numMatchTermine);
    if (slots.length === 0) return [];

    const matchLive = await this.matchLiveRepo.findByNumMatch(numMatchTermine);
    if (!matchLive || matchLive.etat !== MatchLiveEtat.TERMINE) return [];

    if (matchLive.score1Cache === matchLive.score2Cache) {
      return this.marquerAmbigus(
        slots,
        `Score à égalité (${matchLive.score1Cache}-${matchLive.score2Cache}) sur le match ${numMatchTermine}, vainqueur indéterminable`,
      );
    }

    const equipes = await this.matchWriter.trouverEquipesMatch(numMatchTermine);
    if (!equipes || equipes.equipeId1 == null || equipes.equipeId2 == null) {
      return this.marquerAmbigus(
        slots,
        `Équipes non identifiées pour le match ${numMatchTermine}`,
      );
    }

    const cote1Gagne = matchLive.score1Cache > matchLive.score2Cache;

    const resultats: ResolutionResult[] = [];
    for (const slot of slots) {
      // Branche sur le rôle du slot : VAINQUEUR prend le score le plus haut,
      // PERDANT prend le score le plus bas (tableau haute/basse).
      const slotRole = slot.role ?? 'VAINQUEUR';
      const prendre1 = slotRole === 'VAINQUEUR' ? cote1Gagne : !cote1Gagne;
      const equipeId = prendre1 ? equipes.equipeId1 : equipes.equipeId2;
      const equipeNom = prendre1 ? equipes.equipe1Nom : equipes.equipe2Nom;
      resultats.push(await this.resoudre(slot, equipeId, equipeNom, false));
    }
    return resultats;
  }

  /**
   * Résolution par classement de poule (spec §3b, §4) pour une poule donnée :
   * ne résout que si la poule est complète (round-robin terminé) et que le
   * rang cible n'est pas ambigu (égalité non départagée).
   */
  async resoudrePoule(
    editionId: number,
    pouleCode: string,
  ): Promise<ResolutionResult[]> {
    const slots = await this.slotRepo.findNonResolusParPoule(
      editionId,
      pouleCode,
    );
    if (slots.length === 0) return [];

    const poule = await this.equipeRepo.findClassementByPoule(pouleCode);
    if (!poule || poule.equipes.length === 0) return [];

    const nbEquipesPoule = poule.equipes.length;
    const complete = poule.equipes.every((e) => e.joues >= nbEquipesPoule - 1);
    if (!complete) return [];

    const resultats: ResolutionResult[] = [];
    for (const slot of slots) {
      resultats.push(await this.resoudreSlotDePoule(slot, poule.equipes));
    }
    return resultats;
  }

  /** Revérifie toutes les poules ayant au moins un slot non résolu pour l'édition (spec §3b, endpoint revalidate). */
  async revaliderToutesLesPoules(
    editionId: number,
  ): Promise<ResolutionResult[]> {
    const slots = await this.slotRepo.findAllByEdition(editionId);
    const poulesConcernees = new Set(
      slots
        .filter((s) => !s.resolu && s.pouleCode)
        .map((s) => s.pouleCode as string),
    );

    const resultats: ResolutionResult[] = [];
    for (const pouleCode of poulesConcernees) {
      resultats.push(...(await this.resoudrePoule(editionId, pouleCode)));
    }
    return resultats;
  }

  private async resoudreSlotDePoule(
    slot: PlanningMatchSlot,
    equipesTriees: Equipe[],
  ): Promise<ResolutionResult> {
    const rang = slot.rangPoule ?? 0;
    const candidate = equipesTriees[rang - 1];
    if (!candidate) {
      return {
        slot,
        ambigu: true,
        raison: `Aucune équipe au rang ${rang} de la poule ${slot.pouleCode}`,
      };
    }

    // `candidate.rang` vient désormais de ClassementPouleEngine, qui applique
    // réellement ParametresSportifs.reglesTieBreak et regroupe les égalités
    // (rang partagé, ranking de compétition 1,2,2,4 — jamais départagé par un
    // ID technique). La position dans le tableau ne suffit plus à elle seule
    // dès qu'une égalité réelle existe : `equipesTriees[rang - 1]` peut alors
    // pointer sur une équipe dont le rang réel diffère du rang demandé (ex.
    // deux équipes à rang=2, une demande de rang=3 pointe sur l'une d'elles).
    // On vérifie donc explicitement `candidate.rang === rang`, en plus du
    // test de voisinage (qui reste utile pour capter l'égalité au bord de la
    // sélection, ex. rang 2 demandé alors que les rangs 2 et 3 sont ex æquo).
    const voisinAuDessus = equipesTriees[rang - 2];
    const voisinEnDessous = equipesTriees[rang];
    const rangIncoherent = candidate.rang !== rang;
    const exAequoAvecVoisin =
      (voisinAuDessus && voisinAuDessus.rang === candidate.rang) ||
      (voisinEnDessous && voisinEnDessous.rang === candidate.rang);
    if (rangIncoherent || exAequoAvecVoisin) {
      return {
        slot,
        ambigu: true,
        raison: `Égalité de classement non départagée au rang ${rang} de la poule ${slot.pouleCode}`,
      };
    }

    const equipeId = await this.matchWriter.trouverEquipeIdParNom(
      candidate.name,
    );
    if (equipeId == null) {
      return {
        slot,
        ambigu: true,
        raison: `Équipe "${candidate.name}" introuvable dans TA_EQUIPES`,
      };
    }

    return this.resoudre(slot, equipeId, candidate.name, false);
  }

  private async resoudre(
    slot: PlanningMatchSlot,
    equipeId: number,
    equipeNom: string,
    resoluManuellement: boolean,
  ): Promise<ResolutionResult> {
    if (slot.resolu) {
      // Jamais réécrasé automatiquement (critère d'acceptation 3).
      return {
        slot,
        ambigu: false,
        equipeId: slot.equipeIdResolu!,
        equipeNom: slot.equipeNomResolu!,
      };
    }
    await this.matchWriter.resoudreSlot(
      slot.numMatch,
      slot.cote,
      equipeId,
      equipeNom,
    );
    const resolved = await this.slotRepo.marquerResolu(
      slot.id,
      equipeId,
      equipeNom,
      resoluManuellement,
    );
    this.logger.log(
      `Slot ${slot.id} (match ${slot.numMatch}, côté ${slot.cote}) résolu avec "${equipeNom}" (#${equipeId})`,
    );
    return { slot: resolved, ambigu: false, equipeId, equipeNom };
  }

  private marquerAmbigus(
    slots: PlanningMatchSlot[],
    raison: string,
  ): ResolutionResult[] {
    return slots.map((slot) => ({ slot, ambigu: true, raison }));
  }
}
