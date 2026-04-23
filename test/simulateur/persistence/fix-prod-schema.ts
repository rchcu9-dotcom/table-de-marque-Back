/**
 * Aligne le schéma de rchcu11_tournoi sur rchcu11_tournoi_test
 * Ajoute les colonnes manquantes (PHOTO sur ta_equipes, etc.)
 */
import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL!.replace('rchcu11_tournoi_test', 'rchcu11_tournoi');
const db = new PrismaClient({ datasources: { db: { url } } });

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await db.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?`,
    table, column
  );
  return Number(rows[0]?.c) > 0;
}

async function main() {
  console.log(`Target: ${url.replace(/:[^@]+@/, ':***@')}`);

  // PHOTO column on ta_equipes
  if (!(await columnExists('ta_equipes', 'PHOTO'))) {
    await db.$executeRawUnsafe(`ALTER TABLE ta_equipes ADD COLUMN \`PHOTO\` VARCHAR(255) NULL`);
    console.log('Added PHOTO to ta_equipes ✓');
  } else {
    console.log('PHOTO already exists on ta_equipes');
  }

  const cols = await db.$queryRawUnsafe<any[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ta_equipes' ORDER BY ORDINAL_POSITION`
  );
  console.log('ta_equipes columns:', cols.map((r: any) => r.COLUMN_NAME).join(', '));
}

main().catch(console.error).finally(() => db.$disconnect());
