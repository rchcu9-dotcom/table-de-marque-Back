export class EquipeReferentiel {
  constructor(
    public readonly id: number,
    public readonly nom: string,
    public readonly logoUrl: string | null,
    public readonly active: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
