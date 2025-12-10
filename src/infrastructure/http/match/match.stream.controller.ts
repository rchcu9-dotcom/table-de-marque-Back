import { Controller, Header, Req, Sse } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { map } from 'rxjs/operators';
import type { Request } from 'express';
import { Observable } from 'rxjs';

import { MatchStreamService } from '@/hooks/match-stream.service';

@Controller('matches')
export class MatchStreamController {
  constructor(private readonly streamService: MatchStreamService) {}

  @Sse('stream')
  @Header('Content-Type', 'text/event-stream')
  stream(@Req() req: Request): Observable<MessageEvent> {
    const once = ((req.query.once as string) ?? '').toLowerCase() === 'true';
    return this.streamService.observe({ replayLast: true, completeAfterFirst: once }).pipe(
      map((data) => ({ data }) as MessageEvent),
    );
  }
}
