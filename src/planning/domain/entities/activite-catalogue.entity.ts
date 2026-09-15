export class ActiviteCatalogue {
  constructor(
    public readonly id: number,
    public readonly editionId: number,
    public readonly label: string,
    public readonly dureeParEquipeMin: number,
    public readonly capaciteParallele: number,
    public readonly createdAt: Date,
  ) {}
}
