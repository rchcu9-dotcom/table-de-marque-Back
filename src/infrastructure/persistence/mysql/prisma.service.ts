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
    // Connexion inconditionnelle : le moteur de classement interne
    // (ClassementInterneEquipeRepository) lit TA_MATCHS/ta_edition via ce
    // client quel que soit le driver legacy configuré (EQUIPE_REPOSITORY_DRIVER
    // vaut `google-sheets-public` par défaut, sans jamais valoir `prisma`).
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
