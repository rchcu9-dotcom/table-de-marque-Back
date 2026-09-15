export type TypeJournee = '5V5' | '3V3' | 'MIXTE';

export class InscEditionJour {
  constructor(
    public readonly id: number,
    public readonly editionId: number,
    public readonly numeroJour: number,
    public readonly date: Date,
    public readonly heureDebut: Date,
    public readonly heureFin: Date,
    public readonly typeJournee: TypeJournee,
  ) {}
}
