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
    public competitionType: '5v5' | '3v3' | 'challenge' = '5v5',
    public surface: 'GG' | 'PG' = 'GG',
    public phase: 'brassage' | 'qualification' | 'finales' | null = null,
    public jour: 'J1' | 'J2' | 'J3' | null = null,
  ) {}
}
