import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { startWith, take } from 'rxjs/operators';

type ChallengeStreamEvent = {
  type: 'challenge';
  diff: {
    changed: boolean;
    added: string[];
    updated: string[];
    removed: string[];
  };
  snapshot: unknown;
  timestamp: number;
};

type ObserveOptions = {
  replayLast?: boolean;
  completeAfterFirst?: boolean;
};

@Injectable()
export class ChallengeStreamService {
  private readonly subject = new Subject<ChallengeStreamEvent>();
  private lastEvent?: ChallengeStreamEvent;

  emit(event: ChallengeStreamEvent) {
    this.lastEvent = event;
    this.subject.next(event);
  }

  observe(options?: ObserveOptions): Observable<ChallengeStreamEvent> {
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
