import { Controller, Get, Header, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { interval, Subscription } from 'rxjs';

import { MatchStreamService } from '@/hooks/match-stream.service';
import { formatParisIso } from '@/infrastructure/persistence/mysql/date-paris.utils';

type MatchLike = {
  id: string;
  date: Date;
  teamA: string;
  teamB: string;
  status: string;
  scoreA?: number | null;
  scoreB?: number | null;
  teamALogo?: string | null;
  teamBLogo?: string | null;
  pouleCode?: string | null;
  pouleName?: string | null;
  competitionType?: string | null;
  surface?: string | null;
  phase?: string | null;
  jour?: string | null;
};

function mapMatchDate(match: MatchLike) {
  return {
    ...match,
    date: formatParisIso(new Date(match.date)),
  };
}

@Controller('matches')
export class MatchStreamController {
  constructor(private readonly streamService: MatchStreamService) {}

  @Get('stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  stream(@Req() req: Request, @Res() res: Response) {
    // Debug log to confirm handler hit

    console.log('[SSE] /matches/stream handler invoked');
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    // ping initial pour ouvrir la connexion
    res.write(':ok\n\n');

    const once = ((req.query.once as string) ?? '').toLowerCase() === 'true';
    const send = (payload: unknown) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const sub: Subscription = this.streamService
      .observe({ replayLast: true, completeAfterFirst: once })
      .subscribe((event) => {
        if (event.type !== 'matches') {
          send(event);
          return;
        }
        send({
          ...event,
          matches: Array.isArray(event.matches)
            ? event.matches.map((match) => mapMatchDate(match as MatchLike))
            : [],
        });
      });

    const ping = once
      ? null
      : interval(25000).subscribe(() =>
          send({ type: 'ping', timestamp: Date.now() }),
        );

    req.on('close', () => {
      sub.unsubscribe();
      ping?.unsubscribe();
      res.end();
    });
  }
}
