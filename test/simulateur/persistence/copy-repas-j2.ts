import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const n = await db.$executeRawUnsafe(
    `UPDATE ta_classement SET REPAS_DIMANCHE = REPAS_SAMEDI WHERE GROUPE_NOM IN ('E','F','G','H')`
  );
  console.log(`${n} rows updated`);
  const rows = await db.$queryRawUnsafe<any[]>(
    `SELECT GROUPE_NOM, EQUIPE, DATE_FORMAT(REPAS_SAMEDI,'%H:%i') AS RS, DATE_FORMAT(REPAS_DIMANCHE,'%H:%i') AS RD
     FROM ta_classement WHERE GROUPE_NOM IN ('E','F','G','H') ORDER BY GROUPE_NOM, ORDRE`
  );
  console.table(rows);
}
main().catch(console.error).finally(() => db.$disconnect());
