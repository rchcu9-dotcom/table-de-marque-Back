import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const url =
      process.env.DATABASE_URL ?? PrismaService.buildDatabaseUrlFromEnv();
    super(url ? { datasources: { db: { url } } } : {});
  }

  async onModuleInit() {
    const drivers = [
      process.env.MATCH_REPOSITORY_DRIVER,
      process.env.EQUIPE_REPOSITORY_DRIVER,
      process.env.JOUEUR_REPOSITORY_DRIVER,
      process.env.ATELIER_REPOSITORY_DRIVER,
      process.env.TENTATIVE_ATELIER_REPOSITORY_DRIVER,
    ];
    const shouldConnect = drivers.some(
      (value) => (value ?? '').trim().toLowerCase() === 'prisma',
    );
    if (!shouldConnect) return;
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private static buildDatabaseUrlFromEnv(): string | null {
    const host = (process.env.DB_HOST ?? '').trim();
    const user = (process.env.DB_USER ?? '').trim();
    const pass = (process.env.DB_PASS ?? '').trim();
    const name = (process.env.DB_NAME ?? '').trim();
    const port = (process.env.DB_PORT ?? '3306').trim();
    if (!host || !user || !name) return null;
    const encodedPass = encodeURIComponent(pass);
    return `mysql://${encodeURIComponent(user)}:${encodedPass}@${host}:${port}/${encodeURIComponent(name)}`;
  }
}
