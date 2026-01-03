import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const driverEquipe = (
      process.env.EQUIPE_REPOSITORY_DRIVER ?? ''
    ).toLowerCase();
    const driverMatch = (
      process.env.MATCH_REPOSITORY_DRIVER ?? ''
    ).toLowerCase();

    let provider = (process.env.DB_PROVIDER ?? '').toLowerCase();

    if (!provider) {
      if (
        driverEquipe === 'mysql' ||
        driverEquipe === 'prisma' ||
        driverMatch === 'mysql' ||
        driverMatch === 'prisma'
      ) {
        provider = 'mysql';
        process.env.DB_PROVIDER = 'mysql';
      }
    }

    const hasUrl = !!process.env.DATABASE_URL;
    if (!hasUrl && provider === 'mysql') {
      const host = process.env.DB_HOST ?? 'localhost';
      const user = process.env.DB_USER ?? 'root';
      const pass = process.env.DB_PASS ?? '';
      const name = process.env.DB_NAME ?? 'test';
      const port = process.env.DB_PORT ?? '3306';

      process.env.DATABASE_URL = `mysql://${encodeURIComponent(
        user,
      )}:${encodeURIComponent(pass)}@${host}:${port}/${name}`;
    }

    super();
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
