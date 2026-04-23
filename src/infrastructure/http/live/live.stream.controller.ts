import { Controller, Get, Header, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { interval, Subscription } from 'rxjs';

import { LiveStreamService } from '@/hooks/live-stream.service';

@Controller('live')
export class LiveStreamController {
  constructor(private readonly streamService: LiveStreamService) {}

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
    const send = (eventType: string, payload: unknown) => {
      res.write(`event: ${eventType}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    let ping: Subscription | null = null;
    const sub: Subscription = this.streamService
      .observe({ replayLast: true, completeAfterFirst: once })
      .subscribe({
        next: (event) => send('live_status', event),
        complete: () => {
          ping?.unsubscribe();
          res.end();
        },
      });

    ping = once
      ? null
      : interval(25000).subscribe(() =>
          send('ping', { type: 'ping', timestamp: Date.now() }),
        );

    req.on('close', () => {
      sub.unsubscribe();
      ping?.unsubscribe();
    });
  }
}
