import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '@/infrastructure/persistence/mysql/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async check(@Res() res: Response): Promise<void> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      res.status(HttpStatus.OK).json({
        status: 'ok',
        db: 'ok',
        uptime: process.uptime(),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'error',
        db: 'unreachable',
        error: message,
      });
    }
  }
}
