// Garde-fou commun : ouvre un client Prisma uniquement si la cible est une base
// de TEST. Aucune option de contournement (cf. ADR-002).
import * as path from 'path';
import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import {
  assertSafeTestTarget,
  parseCliArgs,
  parseDatabaseTarget,
  type CliArgs,
  type DatabaseTarget,
} from './lib';

export interface GuardedContext {
  prisma: PrismaClient;
  target: DatabaseTarget;
  serverVersion: string;
  args: CliArgs;
}

/** Masque toute trace de l'URL de connexion ou de son mot de passe dans un message. */
export function redact(message: string): string {
  let out = message;
  const url = process.env.DATABASE_URL;
  if (url) {
    out = out.split(url).join('[DATABASE_URL]');
    try {
      const { password } = new URL(url);
      // Les mots de passe très courts (URL fictives de test) sont ignorés : les
      // remplacer masquerait des lettres ordinaires du message.
      for (const secret of [password, decodeURIComponent(password)]) {
        if (secret.length >= 6) out = out.split(secret).join('***');
      }
    } catch {
      /* URL invalide : déjà rejetée par parseDatabaseTarget */
    }
  }
  return out;
}

export async function openGuardedClient(argv: string[]): Promise<GuardedContext> {
  const args = parseCliArgs(argv);

  // .env.local n'écrase jamais une variable déjà exportée dans le shell : le
  // garde-fou juge l'URL EFFECTIVE, quelle qu'en soit l'origine.
  dotenv.config({
    path: path.resolve(__dirname, '../../.env.local'),
    override: false,
    quiet: true,
  });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Refus : DATABASE_URL est absente (aucun repli sur DB_HOST/DB_NAME).');
  }
  const target = parseDatabaseTarget(databaseUrl);
  const envDbName = process.env.DB_NAME?.trim() || null;

  // 1) Contrôle statique AVANT toute connexion.
  assertSafeTestTarget({
    urlDatabase: target.database,
    envDbName,
    serverDatabase: null,
    cliTarget: args.target,
  });
  console.log(`Cible : ${target.host}:${target.port} / base « ${target.database} » (--target confirmé)`);

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    // 2) Contrôle dynamique : ce que le serveur dit réellement.
    const rows = await prisma.$queryRawUnsafe<{ db: string | null; version: string }[]>(
      'SELECT DATABASE() AS db, VERSION() AS version',
    );
    const serverDatabase = rows[0]?.db ?? null;
    assertSafeTestTarget({
      urlDatabase: target.database,
      envDbName,
      serverDatabase: serverDatabase ?? '(aucune)',
      cliTarget: args.target,
    });
    console.log(`Serveur : version ${rows[0].version}, base connectée « ${serverDatabase} »`);
    return { prisma, target, serverVersion: rows[0].version, args };
  } catch (error) {
    await prisma.$disconnect().catch(() => undefined);
    throw error;
  }
}

/** Point d'entrée commun des scripts : message redacté et code retour ≠ 0 en cas d'échec. */
export function runMain(main: () => Promise<number | void>): void {
  main().then(
    (code) => process.exit(typeof code === 'number' ? code : 0),
    (error: unknown) => {
      const text = error instanceof Error ? error.message : String(error);
      console.error(`ÉCHEC : ${redact(text)}`);
      process.exit(1);
    },
  );
}
