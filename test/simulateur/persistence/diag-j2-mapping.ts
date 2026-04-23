import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  // Current J2 classement (groups E/F/G/H)
  const classement = await db.$queryRawUnsafe<any[]>(
    `SELECT GROUPE_NOM, ORDRE, EQUIPE, EQUIPE_ID,
       DATE_FORMAT(REPAS_SAMEDI,'%H:%i') AS RS,
       DATE_FORMAT(REPAS_DIMANCHE,'%H:%i') AS RD,
       DATE_FORMAT(CHALLENGE_SAMEDI,'%H:%i') AS CS
     FROM ta_classement
     WHERE GROUPE_NOM IN ('E','F','G','H')
     ORDER BY GROUPE_NOM, ORDRE`
  );
  console.log('\n=== ta_classement J2 (E/F/G/H) ===');
  console.table(classement);

  // Current J2 matches in TA_MATCHS (date 2026-05-24)
  const matchs = await db.$queryRawUnsafe<any[]>(
    `SELECT NUM_MATCH, EQUIPE1, EQUIPE2, EQUIPE_ID1, EQUIPE_ID2,
       DATE_FORMAT(DATEHEURE,'%H:%i') AS HEURE,
       MATCH_CASE
     FROM TA_MATCHS
     WHERE DATE(DATEHEURE) = '2026-05-24'
     ORDER BY NUM_MATCH`
  );
  console.log('\n=== TA_MATCHS J2 (2026-05-24) ===');
  console.table(matchs);

  // J1 classement for reference
  const j1 = await db.$queryRawUnsafe<any[]>(
    `SELECT GROUPE_NOM, ORDRE, EQUIPE, EQUIPE_ID,
       DATE_FORMAT(REPAS_SAMEDI,'%H:%i') AS RS,
       DATE_FORMAT(CHALLENGE_SAMEDI,'%H:%i') AS CS
     FROM ta_classement
     WHERE GROUPE_NOM IN ('A','B','C','D')
     ORDER BY GROUPE_NOM, ORDRE`
  );
  console.log('\n=== ta_classement J1 (A/B/C/D) ===');
  console.table(j1);
}

main().catch(console.error).finally(() => db.$disconnect());
