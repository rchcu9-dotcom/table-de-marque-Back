export class MatchPenalite {
  constructor(
    public readonly id: number,
    public readonly numMatch: number,
    public readonly equipeId: number,
    public readonly joueurId: number,
    public readonly typePenaliteCode: string,
    public readonly dureeMinutes: number,
    public readonly tempsJeuDebut: number,
    public readonly createdAt: Date,
  ) {}
}
