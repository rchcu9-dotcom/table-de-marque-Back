import { Controller, Header, Req, Sse } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';

import { MatchStreamService } from '@/hooks/match-stream.service';

@Controller('matches')
export class MatchStreamController {
  constructor(private readonly streamService: MatchStreamService) {}

  @Sse('stream')
  @Header('Content-Type', 'text/event-stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  stream(@Req() req: Request): Observable<MessageEvent> {
    const once = ((req.query.once as string) ?? '').toLowerCase() === 'true';
    const initial =
      this.streamService.getLastEvent() ?? {
        type: 'heartbeat',
        diff: { changed: false, added: [], updated: [], removed: [] },
        matches: [],
        timestamp: Date.now(),
      };

    return new Observable<MessageEvent>((subscriber) => {
      subscriber.next({ data: initial });

      const sub = this.streamService
        .observe({ replayLast: false, completeAfterFirst: once })
        .subscribe({
          next: (event) => subscriber.next({ data: event }),
          error: (err) => subscriber.error(err),
        });

      return () => {
        sub.unsubscribe();
      };
    });
  }
}
