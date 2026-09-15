import { MatchLiveEtat } from '../enums/match-live-etat.enum';

export class MatchLive {
  constructor(
    public readonly numMatch: number,
    public readonly etat: MatchLiveEtat,
    public readonly tempsEcouleSecondes: number,
    public readonly chronoEnCours: boolean,
    public readonly chronoDerniereMajAt: Date | null,
    public readonly score1Cache: number,
    public readonly score2Cache: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
