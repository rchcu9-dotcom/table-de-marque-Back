export class MatchTypePenalite {
  constructor(
    public readonly code: string,
    public readonly libelle: string,
    public readonly dureeMinutesDefaut: number,
    public readonly actif: boolean,
  ) {}
}
