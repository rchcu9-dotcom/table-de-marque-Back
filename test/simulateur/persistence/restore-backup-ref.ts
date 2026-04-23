/**
 * Restore backup-ref-tournoi-2026.sql then fix all DATETIME columns +2h
 * (backup was generated from a DB already shifted -2h from Paris wall clock)
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
  const sqlPath = join(process.cwd(), 'prisma/backup-ref-tournoi-2026.sql');
  const sql = readFileSync(sqlPath, 'utf8');

  // Split on ; but keep only non-empty statements, skip USE / SET FK
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--') && !s.startsWith('USE') && !s.startsWith('SET'));

  console.log(`Applying ${statements.length} SQL statements...`);

  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt);
  }

  console.log('Backup applied. Fixing datetime +2h on ta_equipes...');
  await prisma.$executeRawUnsafe(`
    UPDATE ta_equipes
    SET REPAS_SAMEDI    = DATE_ADD(REPAS_SAMEDI, INTERVAL 2 HOUR),
        CHALLENGE_SAMEDI = DATE_ADD(CHALLENGE_SAMEDI, INTERVAL 2 HOUR)
  `);

  console.log('Fixing datetime +2h on ta_classement...');
  await prisma.$executeRawUnsafe(`
    UPDATE ta_classement
    SET REPAS_SAMEDI     = DATE_ADD(REPAS_SAMEDI, INTERVAL 2 HOUR),
        CHALLENGE_SAMEDI = DATE_ADD(CHALLENGE_SAMEDI, INTERVAL 2 HOUR)
    WHERE REPAS_SAMEDI IS NOT NULL OR CHALLENGE_SAMEDI IS NOT NULL
  `);

  console.log('Fixing datetime +2h on TA_MATCHS...');
  await prisma.$executeRawUnsafe(`
    UPDATE TA_MATCHS
    SET DATEHEURE = DATE_ADD(DATEHEURE, INTERVAL 2 HOUR)
  `);

  console.log('\nVerification ta_equipes:');
  const equipes = await prisma.$queryRawUnsafe<any[]>(
    `SELECT ID, EQUIPE, DATE_FORMAT(REPAS_SAMEDI,'%H:%i') AS REPAS FROM ta_equipes ORDER BY ID LIMIT 5`
  );
  console.table(equipes);

  console.log('\nVerification ta_classement J1:');
  const classement = await prisma.$queryRawUnsafe<any[]>(
    `SELECT GROUPE_NOM, ORDRE, EQUIPE, DATE_FORMAT(REPAS_SAMEDI,'%H:%i') AS REPAS
     FROM ta_classement WHERE GROUPE_NOM IN ('A','B') ORDER BY GROUPE_NOM, ORDRE`
  );
  console.table(classement);

  console.log('\nVerification TA_MATCHS first J1:');
  const matchs = await prisma.$queryRawUnsafe<any[]>(
    `SELECT NUM_MATCH, EQUIPE1, EQUIPE2, DATE_FORMAT(DATEHEURE,'%Y-%m-%d %H:%i') AS DH, ETAT FROM TA_MATCHS LIMIT 5`
  );
  console.table(matchs);

  console.log('\nDone.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
