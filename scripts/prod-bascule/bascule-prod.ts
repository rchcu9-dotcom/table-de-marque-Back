// Application de la migration 20261018000000_prod_rattrapage_preparation_tournoi
// sur la base de PRODUCTION (rchcu11_tournoi) : rattrapage additif du schéma et
// passage en mode « Préparation tournoi » (édition 2026 TOURNOI_DEMARRE +
// édition 2027 CREATION_NOUVEAU_TOURNOI).
//
// Pendant explicite d'ADR-002 : les scripts de table-de-marque-test-db/ ne
// peuvent pas atteindre la prod ; celui-ci ne peut atteindre QUE la prod.
//
// Usage (depuis back/) — l'URL n'est jamais lue depuis .env.local :
//   PROD_DATABASE_URL='mysql://…/rchcu11_tournoi?ssl=true' \
//     npx tsx scripts/prod-bascule/bascule-prod.ts --target=rchcu11_tournoi            # essai à blanc
//   PROD_DATABASE_URL=… npx tsx scripts/prod-bascule/bascule-prod.ts --target=rchcu11_tournoi --apply
//
// Avec --apply : dump JSON des tables legacy (TA_*, ta_partenaires) dans out/
// AVANT toute écriture (spec cycle annuel §2.3), puis exécution, puis contrôles.
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { parseDatabaseTarget, splitSqlStatements } from '../table-de-marque-test-db/lib';

const PROD_DATABASE = 'rchcu11_tournoi';
const SOURCE_DATABASE = 'rchcu11_tournoi_test';
const MIGRATION = '20261018000000_prod_rattrapage_preparation_tournoi';
const MIGRATION_FILE = path.resolve(__dirname, '../../prisma/migrations', MIGRATION, 'migration.sql');
const OUT_DIR = path.resolve(__dirname, 'out');
const LEGACY_TABLES = ['TA_MATCHS', 'ta_equipes', 'ta_classement', 'ta_joueurs', 'ta_configuration', 'ta_partenaires'];

const ALLOWED_STATEMENTS: RegExp[] = [
  /^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+`(insc|planning|format|presentation)_[a-z_]+`/i,
  /^ALTER\s+TABLE\s+`[A-Za-z_]+`\s+ADD\s+CONSTRAINT\s+`[A-Za-z0-9_]+`\s+FOREIGN\s+KEY\s+IF\s+NOT\s+EXISTS\b/i,
  /^INSERT\s+INTO\s+`(insc_utilisateurs|presentation_articles|insc_editions|insc_edition_annees_age)`/i,
];

interface Args {
  target: string | null;
  apply: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { target: null, apply: false };
  for (const arg of argv) {
    if (arg.startsWith('--target=')) args.target = arg.slice('--target='.length);
    else if (arg === '--apply') args.apply = true;
    else throw new Error(`Argument inconnu : ${arg}`);
  }
  return args;
}

function redact(message: string, url: string): string {
  let out = message.split(url).join('[PROD_DATABASE_URL]');
  try {
    const { password } = new URL(url);
    for (const secret of [password, decodeURIComponent(password)]) {
      if (secret.length >= 6) out = out.split(secret).join('***');
    }
  } catch {
    /* URL invalide : rejetée plus tôt */
  }
  return out;
}

const json = (value: unknown): string =>
  JSON.stringify(value, (_k, v: unknown) => (typeof v === 'bigint' ? Number(v) : v), 2);
const summarize = (statement: string): string => statement.replace(/\s+/g, ' ').slice(0, 100);
const quoteIdent = (name: string): string => `\`${name.replace(/`/g, '``')}\``;

async function count(prisma: PrismaClient, table: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ n: bigint | number }[]>(`SELECT COUNT(*) AS n FROM ${quoteIdent(table)}`);
  return Number(rows[0].n);
}

async function tableExists(prisma: PrismaClient, table: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ n: bigint | number }[]>(
    `SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
    table,
  );
  return Number(rows[0].n) > 0;
}

async function legacyCounts(prisma: PrismaClient): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of LEGACY_TABLES) counts[table] = await count(prisma, table);
  return counts;
}

async function dumpLegacyTables(prisma: PrismaClient, stamp: string): Promise<string> {
  const dump: Record<string, unknown[]> = {};
  for (const table of LEGACY_TABLES) {
    dump[table] = await prisma.$queryRawUnsafe<unknown[]>(`SELECT * FROM ${quoteIdent(table)}`);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `dump-ta-avant-bascule-${stamp}.json`);
  fs.writeFileSync(file, json(dump));
  // Relecture : un dump illisible ou incomplet bloque l'écriture.
  const relu = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown[]>;
  for (const table of LEGACY_TABLES) {
    if (!Array.isArray(relu[table]) || relu[table].length !== dump[table].length) {
      throw new Error(`Dump invalide pour ${table} : écriture annulée.`);
    }
  }
  return file;
}

async function main(url: string): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const target = parseDatabaseTarget(url);

  // Contrôles statiques AVANT connexion.
  if (target.database !== PROD_DATABASE) {
    throw new Error(`Refus : PROD_DATABASE_URL vise « ${target.database} », seule « ${PROD_DATABASE} » est autorisée.`);
  }
  if (args.target !== PROD_DATABASE) {
    throw new Error(`Refus : --target=${PROD_DATABASE} est obligatoire.`);
  }

  const statements = splitSqlStatements(fs.readFileSync(MIGRATION_FILE, 'utf8'));
  statements.forEach((statement, index) => {
    if (!ALLOWED_STATEMENTS.some((pattern) => pattern.test(statement))) {
      throw new Error(`Instruction n°${index + 1} hors liste blanche, refusée : ${summarize(statement)}`);
    }
  });

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const [server] = await prisma.$queryRawUnsafe<{ db: string | null; version: string }[]>(
      'SELECT DATABASE() AS db, VERSION() AS version',
    );
    if (server.db !== PROD_DATABASE) {
      throw new Error(`Refus : le serveur indique être connecté à « ${server.db} ».`);
    }
    console.log(`Cible : ${target.host}:${target.port} / « ${server.db} » — ${server.version}`);

    // Pré-requis : les données d'amorçage sont lues dans la base de test.
    const sources = await prisma.$queryRawUnsafe<{ annee: number; etape: string }[]>(
      `SELECT annee, etape FROM ${quoteIdent(SOURCE_DATABASE)}.insc_editions WHERE annee IN (2026, 2027) ORDER BY annee`,
    );
    if (sources.length !== 2) {
      throw new Error(`Pré-requis : ${SOURCE_DATABASE}.insc_editions doit contenir les éditions 2026 et 2027 (trouvé : ${sources.length}).`);
    }
    const editionsDejaLa = (await tableExists(prisma, 'insc_editions')) ? await count(prisma, 'insc_editions') : 0;
    console.log(`Éditions déjà présentes en prod : ${editionsDejaLa}`);

    console.log(`\nMigration ${MIGRATION} — ${statements.length} instruction(s), toutes dans la liste blanche :`);
    statements.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)}. ${summarize(s)}`));

    if (!args.apply) {
      console.log('\nEssai à blanc : aucune écriture. Relancer avec --apply pour exécuter.');
      return 0;
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const avant = await legacyCounts(prisma);
    const dumpFile = await dumpLegacyTables(prisma, stamp);
    console.log(`\nDump préalable (TA_* + ta_partenaires) : ${path.relative(process.cwd(), dumpFile)}`);

    const results: { index: number; summary: string; ok: boolean; error?: string }[] = [];
    let failed = false;
    for (const [i, statement] of statements.entries()) {
      try {
        await prisma.$executeRawUnsafe(statement);
        results.push({ index: i + 1, summary: summarize(statement), ok: true });
      } catch (error) {
        const message = redact(error instanceof Error ? error.message : String(error), url);
        results.push({ index: i + 1, summary: summarize(statement), ok: false, error: message.slice(-400) });
        console.error(`  ${i + 1}. ÉCHEC : ${message.split('\n').slice(-2).join(' ')}`);
        failed = true;
        break;
      }
    }
    console.log(`\nInstructions exécutées : ${results.filter((r) => r.ok).length}/${statements.length}`);

    // Contrôles : données legacy intactes, mode Préparation effectif.
    const apres = await legacyCounts(prisma);
    const anomalies = LEGACY_TABLES.filter((t) => avant[t] !== apres[t]).map(
      (t) => `${t} : ${avant[t]} → ${apres[t]} lignes`,
    );
    const editions = await prisma.$queryRawUnsafe<{ id: number; annee: number; etape: string }[]>(
      'SELECT id, annee, etape FROM insc_editions ORDER BY created_at DESC',
    );
    const active = editions.find((e) => e.etape !== 'CREATION_NOUVEAU_TOURNOI');
    const enPreparation = editions.find((e) => e.etape === 'CREATION_NOUVEAU_TOURNOI');
    if (active?.annee !== 2026 || active.etape !== 'TOURNOI_DEMARRE') {
      anomalies.push(`édition active attendue 2026/TOURNOI_DEMARRE, obtenue ${json(active ?? null)}`);
    }
    if (enPreparation?.annee !== 2027) {
      anomalies.push(`édition en préparation attendue 2027, obtenue ${json(enPreparation ?? null)}`);
    }
    const organisateurs = await prisma.$queryRawUnsafe<{ n: bigint | number }[]>(
      `SELECT COUNT(*) AS n FROM insc_utilisateurs WHERE role = 'ORGANISATEUR'`,
    );
    if (Number(organisateurs[0].n) === 0) anomalies.push('aucun compte ORGANISATEUR');

    console.log('\nContrôles :');
    console.log(`  éditions : ${editions.map((e) => `${e.annee}=${e.etape}`).join(', ')}`);
    console.log(`  organisateurs : ${Number(organisateurs[0].n)}`);
    console.log(`  tables legacy : ${anomalies.some((a) => a.includes('lignes')) ? 'MODIFIÉES' : 'inchangées'}`);
    for (const a of anomalies) console.error(`  ANOMALIE : ${a}`);

    const reportFile = path.join(OUT_DIR, `bascule-${stamp}.json`);
    fs.writeFileSync(
      reportFile,
      json({ date: new Date().toISOString(), host: target.host, database: server.db, version: server.version,
        migration: MIGRATION, dumpFile: path.basename(dumpFile), results, avant, apres, editions, anomalies }),
    );
    console.log(`\nRapport (sans secret) : ${path.relative(process.cwd(), reportFile)}`);

    const ok = !failed && anomalies.length === 0;
    console.log(`Résultat : ${ok ? 'SUCCÈS' : 'ÉCHEC'}`);
    return ok ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

const url = process.env.PROD_DATABASE_URL ?? '';
main(url).then(
  (code) => process.exit(code),
  (error: unknown) => {
    const text = error instanceof Error ? error.message : String(error);
    console.error(`ÉCHEC : ${url ? redact(text, url) : text}`);
    process.exit(1);
  },
);
