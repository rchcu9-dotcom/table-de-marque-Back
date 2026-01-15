import { Controller, Get, Header, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { interval, Subscription } from 'rxjs';

import { ChallengeStreamService } from '@/hooks/challenge-stream.service';

@Controller('challenge')
export class ChallengeStreamController {
  constructor(private readonly streamService: ChallengeStreamService) {}

  @Get('stream')
  @Header('Cache-Control', 'no-cache')
  @Header('Connection', 'keep-alive')
  stream(@Req() req: Request, @Res() res: Response) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
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
