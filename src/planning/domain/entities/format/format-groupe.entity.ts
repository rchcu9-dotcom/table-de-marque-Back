import { FormatPlace } from './format-place.entity';
import { FormatGroupeFormule } from '../../enums/format-groupe-formule.enum';

export class FormatGroupe {
  constructor(
    public readonly id: number,
    public readonly phaseId: number,
    public readonly nom: string,
    public readonly ordre: number,
    public readonly places: FormatPlace[],
    public readonly formule: FormatGroupeFormule = FormatGroupeFormule.CHAMPIONNAT,
  ) {}
}

/**
 * Déduit la mécanique de jeu d'un groupe à partir de son effectif.
 * 2 places → match unique aller simple.
 * ≥3 places → la formule configurée sur le groupe (championnat par défaut,
 * ou ronde suisse si choisie par l'organisateur).
 */
export function mecaniqueGroupe(
  groupe: FormatGroupe,
): 'MATCH_UNIQUE' | 'CHAMPIONNAT' | 'RONDE_SUISSE' {
  if (groupe.places.length === 2) return 'MATCH_UNIQUE';
  return groupe.formule;
}
