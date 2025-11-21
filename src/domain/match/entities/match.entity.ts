export class Match {
  constructor(
    public id: string,
    public date: Date,
    public teamA: string,
    public teamB: string,
    public status: 'planned' | 'ongoing' | 'finished' | 'deleted' = 'planned',
  ) {}
}
