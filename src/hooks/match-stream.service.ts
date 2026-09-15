import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { startWith, take } from 'rxjs/operators';

type MatchStreamEvent = {
  type: 'matches';
  diff: {
    changed: boolean;
    added: string[];
    updated: string[];
    removed: string[];
  };
  matches: any[];
  timestamp: number;
};

export type MatchLiveStreamEvent = {
  type: 'match-live';
  numMatch: number;
  etat: string;
  tempsEcouleSecondes: number;
  chronoEnCours: boolean;
  chronoDerniereMajAt: string | null;
  score1: number;
  score2: number;
  timestamp: number;
};

type AnyStreamEvent = MatchStreamEvent | MatchLiveStreamEvent;

type ObserveOptions = {
  replayLast?: boolean;
  completeAfterFirst?: boolean;
};

@Injectable()
export class MatchStreamService {
  private readonly subject = new Subject<AnyStreamEvent>();
  private lastEvent?: AnyStreamEvent;

  emit(event: AnyStreamEvent) {
    this.lastEvent = event;
    this.subject.next(event);
  }

  observe(options?: ObserveOptions): Observable<AnyStreamEvent> {
    const replay = options?.replayLast ?? false;
    const completeAfterFirst = options?.completeAfterFirst ?? false;

    let stream = this.subject.asObservable();
    if (replay && this.lastEvent) {
      stream = stream.pipe(startWith(this.lastEvent));
    }
    if (completeAfterFirst) {
      stream = stream.pipe(take(1));
    }
    return stream;
  }
}
