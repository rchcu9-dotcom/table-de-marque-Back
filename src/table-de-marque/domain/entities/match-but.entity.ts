export class MatchBut {
  constructor(
    public readonly id: number,
    public readonly numMatch: number,
    public readonly equipeId: number,
    public readonly buteurId: number,
    public readonly assist1Id: number | null,
    public readonly assist2Id: number | null,
    public readonly tempsJeuSecondes: number,
    public readonly createdAt: Date,
  ) {}
}
