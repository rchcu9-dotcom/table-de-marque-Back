export class Match {
  constructor(
    public id: string,
    public date: Date,
    public teamA: string,
    public teamB: string,
    public status: 'planned' | 'ongoing' | 'finished' | 'deleted' = 'planned',
    public scoreA: number | null = null,
    public scoreB: number | null = null,
    public teamALogo?: string | null,
    public teamBLogo?: string | null,
    public pouleCode?: string | null,
    public pouleName?: string | null,
  ) {}
}
