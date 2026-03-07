import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class InscriptionPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const url =
      process.env.DATABASE_URL ??
      InscriptionPrismaService.buildDatabaseUrlFromEnv();
    super(url ? { datasources: { db: { url } } } : {});
  }

  async onModuleInit() {
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
