export class CoachDossier {
  constructor(
    public readonly id: number,
    public readonly dossierId: number,
    public readonly nom: string,
    public readonly prenom: string,
    public readonly presenceRepas: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
