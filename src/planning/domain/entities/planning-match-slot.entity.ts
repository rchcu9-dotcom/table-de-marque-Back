export type PlacementCote = 1 | 2;

export type PlanningSlotRole = 'VAINQUEUR' | 'PERDANT';

/**
 * Un slot non résolu au moment de la confirmation du planning (§2 de la
 * spec) : un côté (`cote`) d'un match `TA_MATCHS` dont l'équipe réelle n'est
 * pas encore connue, avec la règle permettant de la déterminer plus tard
 * (`numMatchSource` pour un vainqueur de bracket, `pouleCode`/`rangPoule`
 * pour un rang de poule).
 */
export class PlanningMatchSlot {
  constructor(
    public readonly id: number,
    public readonly editionId: number,
    public readonly numMatch: number,
    public readonly cote: PlacementCote,
    public readonly ref: string,
    public readonly libellePlaceholder: string,
    public readonly numMatchSource: number | null,
    public readonly pouleCode: string | null,
    public readonly rangPoule: number | null,
    public readonly resolu: boolean,
    public readonly equipeIdResolu: number | null,
    public readonly equipeNomResolu: string | null,
    public readonly resoluAt: Date | null,
    public readonly resoluManuellement: boolean,
    /** VAINQUEUR (défaut) ou PERDANT — discriminant pour la résolution par confrontation. */
    public readonly role: PlanningSlotRole = 'VAINQUEUR',
  ) {}
}

/** Données nécessaires à la création d'un slot, avant toute résolution. */
export type PlanningMatchSlotDraft = {
  editionId: number;
  numMatch: number;
  cote: PlacementCote;
  ref: string;
  libellePlaceholder: string;
  numMatchSource: number | null;
  pouleCode: string | null;
  rangPoule: number | null;
  role?: PlanningSlotRole;
};
