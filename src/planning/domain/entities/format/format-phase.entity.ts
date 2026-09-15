export class FormatPhase {
  constructor(
    public readonly id: number,
    public readonly editionId: number,
    public readonly nom: string,
    public readonly ordre: number,
    /** Ids des InscEditionJour associés à cette phase via FormatPhaseJour. */
    public readonly joursIds: number[],
  ) {}
}
