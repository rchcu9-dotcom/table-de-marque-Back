export class EquipeReferentiel {
  constructor(
    public readonly id: number,
    public readonly nom: string,
    public readonly nomComplet: string | null,
    public readonly logoUrl: string | null,
    public readonly active: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly candidatureEnCours: boolean = false,
    /** Inscriptions qui référencent l'équipe, toutes éditions confondues. */
    public readonly nbCandidatures: number = 0,
  ) {}
}
