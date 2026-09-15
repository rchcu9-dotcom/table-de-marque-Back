import { BadRequestException, Injectable } from '@nestjs/common';
import { MatchLiveEtat } from '../../domain/enums/match-live-etat.enum';

type Action = 'annoncer' | 'demarrer' | 'pauser' | 'terminer';

const TRANSITIONS: Record<
  Action,
  { from: MatchLiveEtat[]; to: MatchLiveEtat }
> = {
  annoncer: { from: [MatchLiveEtat.PLANIFIE], to: MatchLiveEtat.ANNONCE },
  demarrer: {
    from: [MatchLiveEtat.ANNONCE, MatchLiveEtat.EN_PAUSE],
    to: MatchLiveEtat.EN_COURS,
  },
  pauser: { from: [MatchLiveEtat.EN_COURS], to: MatchLiveEtat.EN_PAUSE },
  terminer: { from: [MatchLiveEtat.EN_PAUSE], to: MatchLiveEtat.TERMINE },
};

@Injectable()
export class MatchLiveEtatService {
  transition(current: MatchLiveEtat, action: Action): MatchLiveEtat {
    const rule = TRANSITIONS[action];
    if (!rule.from.includes(current)) {
      throw new BadRequestException(
        `Transition '${action}' impossible depuis l'état '${current}'`,
      );
    }
    return rule.to;
  }
}
