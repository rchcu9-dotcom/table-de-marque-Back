// Rejeu du SQL versionné de la migration « table de marque — match live » sur la
// base de TEST uniquement (SQL brut idempotent, prisma migrate étant inutilisable :
// pas de _prisma_migrations, cf. decisions.json 1788501923813).
//
// Usage :
//   npx tsx scripts/table-de-marque-test-db/apply-migration.ts --target=rchcu11_tournoi_test --dry-run
//   npx tsx scripts/table-de-marque-test-db/apply-migration.ts --target=rchcu11_tournoi_test
//   ... --compat-mysql8   (repli si « ADD COLUMN IF NOT EXISTS » est refusé par le serveur)
import * as fs from 'fs';
import * as path from 'path';
import type { PrismaClient } from '@prisma/client';
import { openGuardedClient, redact, runMain } from './guard';
import {
  assertAdditiveStatements,
  diffCounts,
  EXPECTED_SCHEMA,
  splitSqlStatements,
  type TableCounts,
} from './lib';
import {
  MIGRATIONS_DIR,
  TABLE_DE_MARQUE_MIGRATION,
  inventoryMigrations,
  printChecks,
  printInventory,
  verifySchema,
} from './verify-schema';

const OUT_DIR = path.resolve(__dirname, 'out');

function quoteIdent(name: string): string {
  return `\`${name.replace(/`/g, '``')}\``;
}

async function snapshotCounts(prisma: PrismaClient): Promise<TableCounts> {
  const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT TABLE_NAME AS table_name FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
      ORDER BY TABLE_NAME`,
  );
  const counts: TableCounts = {};
  for (const { table_name } of tables) {
    const rows = await prisma.$queryRawUnsafe<{ n: bigint | number }[]>(
      `SELECT COUNT(*) AS n FROM ${quoteIdent(table_name)}`,
    );
    counts[table_name] = Number(rows[0].n);
  }
  return counts;
}

async function taEquipesColumnCount(prisma: PrismaClient): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ n: bigint | number }[]>(
    `SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'ta_equipes'`,
  );
  return Number(rows[0].n);
}

async function columnExists(prisma: PrismaClient, table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ n: bigint | number }[]>(
    `SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    table,
    column,
  );
  return Number(rows[0].n) > 0;
}

interface StatementResult {
  index: number;
  summary: string;
  outcome: 'exécutée' | 'ignorée (déjà présente)' | 'échec';
  error?: string;
}

const summarize = (statement: string): string => statement.replace(/\s+/g, ' ').slice(0, 90);

runMain(async () => {
  const { prisma, target, serverVersion, args } = await openGuardedClient(process.argv.slice(2));
  try {
    const migrationFile = path.join(MIGRATIONS_DIR, TABLE_DE_MARQUE_MIGRATION, 'migration.sql');
    const statements = splitSqlStatements(fs.readFileSync(migrationFile, 'utf8'));
    assertAdditiveStatements(statements);

    console.log(`\nMigration : ${TABLE_DE_MARQUE_MIGRATION} (${statements.length} instruction(s), toutes additives)`);
    statements.forEach((s, i) => console.log(`  ${i + 1}. ${summarize(s)}`));

    if (args.dryRun) {
      console.log('\n--dry-run : aucune écriture effectuée.');
      return 0;
    }

    console.log(`\nÉcriture sur « ${target.database} » (${target.host}) — mode ${args.compatMysql8 ? 'compat-mysql8' : 'SQL versionné tel quel'}.`);

    const avant = await snapshotCounts(prisma);
    const colonnesTaAvant = await taEquipesColumnCount(prisma);
    const tablesAttendues = Object.keys(EXPECTED_SCHEMA.tables);
    const nouvellesTables = tablesAttendues.filter((t) => !(t in avant));
    const seedManquant = EXPECTED_SCHEMA.seed.length;

    const results: StatementResult[] = [];
    let failed = false;

    for (const [i, statement] of statements.entries()) {
      const base = { index: i + 1, summary: summarize(statement) };
      try {
        let sql = statement;
        const addColumn = statement.match(
          /^ALTER\s+TABLE\s+`([^`]+)`\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+`([^`]+)`/i,
        );
        if (args.compatMysql8 && addColumn) {
          if (await columnExists(prisma, addColumn[1], addColumn[2])) {
            results.push({ ...base, outcome: 'ignorée (déjà présente)' });
            console.log(`  ${base.index}. déjà présente — ignorée`);
            continue;
          }
          sql = statement.replace(/IF\s+NOT\s+EXISTS\s+/i, '');
        }
        await prisma.$executeRawUnsafe(sql);
        results.push({ ...base, outcome: 'exécutée' });
        console.log(`  ${base.index}. exécutée`);
      } catch (error) {
        const message = redact(error instanceof Error ? error.message : String(error));
        results.push({ ...base, outcome: 'échec', error: message.split('\n').slice(-3).join(' ').slice(0, 400) });
        console.error(`  ${base.index}. ÉCHEC : ${message.split('\n').slice(-3).join(' ')}`);
        if (!args.compatMysql8 && i === 0 && /IF\s+NOT\s+EXISTS/i.test(statement)) {
          console.error('  → syntaxe probablement refusée par ce serveur : relancer avec --compat-mysql8.');
        }
        failed = true;
        break;
      }
    }

    const apres = await snapshotCounts(prisma);
    const colonnesTaApres = await taEquipesColumnCount(prisma);
    const diff = diffCounts(avant, apres, {
      nouvellesTables,
      lignesSeed: { match_types_penalite: seedManquant },
    });
    // +1 colonne au plus (EQUIPE_REF_ID), 0 si elle existait déjà ; jamais de suppression.
    const deltaColonnesTa = colonnesTaApres - colonnesTaAvant;
    const colonnesOk = deltaColonnesTa === 0 || deltaColonnesTa === 1;

    console.log('\nVolumétries avant/après (CA4) :');
    console.log(`  tables avant : ${Object.keys(avant).length} — après : ${Object.keys(apres).length} (nouvelles attendues : ${nouvellesTables.join(', ') || 'aucune'})`);
    console.log(`  colonnes ta_equipes : ${colonnesTaAvant} → ${colonnesTaApres}`);
    if (diff.ok && colonnesOk) console.log('  aucune donnée existante modifiée.');
    for (const a of diff.anomalies) console.error(`  ANOMALIE : ${a}`);
    if (!colonnesOk) console.error('  ANOMALIE : variation inattendue du nombre de colonnes de ta_equipes.');

    console.log('\nParité de schéma (CA1-CA3) :');
    const verification = await verifySchema(prisma);
    printChecks(verification.checks.filter((c) => !c.ok || c.warn));
    console.log(`  ${verification.checks.filter((c) => c.ok).length}/${verification.checks.length} contrôles OK`);

    console.log('\nInventaire des autres migrations (CA10, signalement uniquement) :');
    const inventory = await inventoryMigrations(prisma);
    printInventory(inventory);

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const reportPath = path.join(OUT_DIR, `apply-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          date: new Date().toISOString(),
          host: target.host,
          database: target.database,
          serverVersion,
          mode: args.compatMysql8 ? 'compat-mysql8' : 'sql-versionné',
          statements: results,
          countsDiff: diff,
          taEquipesColonnes: { avant: colonnesTaAvant, apres: colonnesTaApres },
          parity: { ok: verification.ok, ko: verification.checks.filter((c) => !c.ok) },
          inventory,
          seedAjoutable: seedManquant,
        },
        null,
        2,
      ),
    );
    console.log(`\nRapport (sans secret) : ${path.relative(process.cwd(), reportPath)}`);

    const ok = !failed && diff.ok && colonnesOk && verification.ok;
    console.log(`Résultat : ${ok ? 'SUCCÈS' : 'ÉCHEC'}`);
    return ok ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
});
