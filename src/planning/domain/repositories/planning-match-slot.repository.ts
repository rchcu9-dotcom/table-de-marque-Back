import {
  PlanningMatchSlot,
  PlanningMatchSlotDraft,
} from '../entities/planning-match-slot.entity';

export const PLANNING_MATCH_SLOT_REPOSITORY = Symbol(
  'PLANNING_MATCH_SLOT_REPOSITORY',
);

/**
 * Bookkeeping des placeholders de planning (`planning_match_slots`) —
 * distinct de `PlanningMatchWriter` : ce dépôt ne touche jamais `TA_MATCHS`
 * (invariant D11 réservé à `PlanningMatchWriter`), uniquement la table
 * additive propre au domaine planning.
 */
export abstract class PlanningMatchSlotRepository {
  abstract createMany(slots: PlanningMatchSlotDraft[]): Promise<void>;
  abstract findAllByEdition(editionId: number): Promise<PlanningMatchSlot[]>;
  abstract findNonResolusParPoule(
    editionId: number,
    pouleCode: string,
  ): Promise<PlanningMatchSlot[]>;
  abstract findByNumMatchSource(
    numMatchSource: number,
  ): Promise<PlanningMatchSlot[]>;
  abstract findById(id: number): Promise<PlanningMatchSlot | null>;
  abstract marquerResolu(
    id: number,
    equipeIdResolu: number,
    equipeNomResolu: string,
    resoluManuellement: boolean,
  ): Promise<PlanningMatchSlot>;
}
