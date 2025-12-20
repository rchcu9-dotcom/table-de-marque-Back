import { Controller, Get, Header, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { interval, Subscription } from 'rxjs';

import { MatchStreamService } from '@/hooks/match-stream.service';

@Controller('matches')
export class MatchStreamController {
  constructor(private readonly streamService: MatchStreamService) {}

  @Get('stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  stream(@Req() req: Request, @Res() res: Response) {
    // Debug log to confirm handler hit
    // eslint-disable-next-line no-console
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
      .subscribe((event) => send(event));

    const ping = once
      ? null
      : interval(25000).subscribe(() => send({ type: 'ping', timestamp: Date.now() }));

    req.on('close', () => {
      sub.unsubscribe();
      ping?.unsubscribe();
      res.end();
    });
  }
}
