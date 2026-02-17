import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { startWith, take } from 'rxjs/operators';

import { LiveStatusResponse } from '@/infrastructure/http/live/live.types';

type LiveStreamEvent = {
  type: 'live_status';
  status: LiveStatusResponse;
  version: string;
  timestamp: number;
};

type ObserveOptions = {
  replayLast?: boolean;
  completeAfterFirst?: boolean;
};

@Injectable()
export class LiveStreamService {
  private readonly subject = new Subject<LiveStreamEvent>();
  private lastEvent?: LiveStreamEvent;

  emit(event: LiveStreamEvent) {
    this.lastEvent = event;
    this.subject.next(event);
  }

  observe(options?: ObserveOptions): Observable<LiveStreamEvent> {
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
