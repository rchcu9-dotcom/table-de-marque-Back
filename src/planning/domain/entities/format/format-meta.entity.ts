import { FormatPhaseFinale } from '../../enums/format-phase-finale.enum';

export class FormatMeta {
  constructor(
    public readonly editionId: number,
    public readonly genereDepuisPreset: FormatPhaseFinale | null,
    public readonly modifieManuellement: boolean,
    public readonly updatedAt: Date,
  ) {}
}
