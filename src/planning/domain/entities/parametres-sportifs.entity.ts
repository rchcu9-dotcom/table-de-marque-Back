import { FormatPhaseFinale } from '../enums/format-phase-finale.enum';

export type MatriceDelaiMinActivite = Record<string, Record<string, number>>;

export type ReglesTieBreak = string[];

export class ParametresSportifs {
  constructor(
    public readonly editionId: number,
    public readonly dureeSurfacageMin: number,
    public readonly dureeMatchPouleMin: number,
    public readonly dureeMatchFinalMin: number,
    public readonly dureeInterMatchMin: number | null,
    public readonly delaiMinActivite: MatriceDelaiMinActivite | null,
    public readonly nbPatinoires: number | null,
    public readonly nbPoules: number | null,
    public readonly nbEquipesParPoule: number | null,
    public readonly nbEquipesQualifieesParPoule: number | null,
    public readonly formatPhaseFinale: FormatPhaseFinale | null,
    public readonly reglesTieBreak: ReglesTieBreak | null,
    public readonly nbPlacesMax: number,
  ) {}
}

export const DEFAULT_TIE_BREAK: ReglesTieBreak = [
  'points',
  'difference_buts',
  'buts_marques',
  'confrontation_directe',
];
