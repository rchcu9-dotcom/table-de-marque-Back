import { FormatPhaseFinale } from '../../enums/format-phase-finale.enum';
import { FormatGroupe } from './format-groupe.entity';
import { FormatLien } from './format-lien.entity';
import { FormatPhase } from './format-phase.entity';

export class FormatGraphe {
  constructor(
    public readonly editionId: number,
    /** Triées par ordre croissant. */
    public readonly phases: FormatPhase[],
    public readonly groupes: FormatGroupe[],
    public readonly liens: FormatLien[],
    public readonly modifieManuellement: boolean,
    public readonly genereDepuisPreset: FormatPhaseFinale | null,
  ) {}
}
