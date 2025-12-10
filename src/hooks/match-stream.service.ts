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

type ObserveOptions = {
  replayLast?: boolean;
  completeAfterFirst?: boolean;
};

@Injectable()
export class MatchStreamService {
  private readonly subject = new Subject<MatchStreamEvent>();
  private lastEvent?: MatchStreamEvent;

  emit(event: MatchStreamEvent) {
    this.lastEvent = event;
    this.subject.next(event);
  }

  observe(options?: ObserveOptions): Observable<MatchStreamEvent> {
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
