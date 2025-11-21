export class Match {
  constructor(
    public readonly id: string,
    public readonly date: Date,
    public readonly teamA: string,
    public readonly teamB: string,
    public status: 'planned' | 'ongoing' | 'finished' = 'planned',
  ) {}
}
