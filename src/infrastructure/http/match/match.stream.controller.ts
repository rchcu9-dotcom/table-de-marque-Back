import { Controller, Header, Req, Sse } from '@nestjs/common';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import { Observable } from 'rxjs';

import { MatchStreamService } from '@/hooks/match-stream.service';

type SseEvent = MessageEvent;

@Controller('matches')
export class MatchStreamController {
  constructor(private readonly stream: MatchStreamService) {}

  @Sse('stream')
  @Header('Content-Type', 'text/event-stream')
  stream(@Req() req: Request): Observable<SseEvent> {
    const once = ((req.query.once as string) ?? '').toLowerCase() === 'true';
    return this.stream.observe({ replayLast: true, completeAfterFirst: once }).pipe(
      map((data) => ({ data })),
    );
  }
}
