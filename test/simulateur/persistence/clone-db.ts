/**
 * Clone rchcu11_tournoi_test → rchcu11_tournoi (structure + données)
 */
import { PrismaClient } from '@prisma/client';

const SRC = process.env.DATABASE_URL!;
const DST = SRC.replace('rchcu11_tournoi_test', 'rchcu11_tournoi');

if (SRC === DST) throw new Error('Source et destination identiques — vérifier DATABASE_URL');

const src = new PrismaClient({ datasources: { db: { url: SRC } } });
const dst = new PrismaClient({ datasources: { db: { url: DST } } });

async function getDstColumns(table: string): Promise<Set<string>> {
  const rows = await dst.$queryRawUnsafe<any[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?`, table
  );
  return new Set(rows.map(r => r.COLUMN_NAME as string));
}

async function cloneTable(table: string, rows: any[]) {
  if (rows.length === 0) { console.log(`  ${table}: 0 rows, skip`); return; }

  const dstCols = await getDstColumns(table);
  // Only insert columns that exist in destination
  const cols = Object.keys(rows[0]).filter(c => dstCols.has(c));
  const colList = cols.map(c => `\`${c}\``).join(', ');
  const placeholders = rows.map(() => `(${cols.map(() => '?').join(', ')})`).join(', ');
  const values = rows.flatMap(r => cols.map(c => r[c] ?? null));

  await dst.$executeRawUnsafe(
    `INSERT INTO \`${table}\` (${colList}) VALUES ${placeholders}`,
    ...values
  );
  console.log(`  ${table}: ${rows.length} rows cloned`);
}

async function main() {
  console.log(`SRC: ${SRC.replace(/:[^@]+@/, ':***@')}`);
  console.log(`DST: ${DST.replace(/:[^@]+@/, ':***@')}`);

  await dst.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=0');

  const tables = [
    'ta_configuration',
    'ta_equipes',
    'ta_joueurs',
    'ta_classement',
    'TA_MATCHS',
  ];

  for (const table of tables) {
    await dst.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\``);
  }

  for (const table of tables) {
    const rows = await src.$queryRawUnsafe<any[]>(`SELECT * FROM \`${table}\``);
    await cloneTable(table, rows);
  }

  // ta_challenge_attempts si elle existe
  const exists = await src.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='ta_challenge_attempts'`
  );
  if (Number(exists[0]?.c) > 0) {
    const rows = await src.$queryRawUnsafe<any[]>(`SELECT * FROM ta_challenge_attempts`);
    await dst.$executeRawUnsafe(`TRUNCATE TABLE ta_challenge_attempts`);
    await cloneTable('ta_challenge_attempts', rows);
  }

  await dst.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=1');

  console.log('\nClone terminé.');

  // Vérification rapide
  const check = await dst.$queryRawUnsafe<any[]>(
    `SELECT 'equipes' AS t, COUNT(*) AS n FROM ta_equipes
     UNION ALL SELECT 'matchs', COUNT(*) FROM TA_MATCHS
     UNION ALL SELECT 'classement', COUNT(*) FROM ta_classement`
  );
  console.table(check);
}

main().catch(console.error).finally(async () => {
  await src.$disconnect();
  await dst.$disconnect();
});
