import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type J1PlannerFile = {
  planning?: Array<{
    teamId: number;
    repas?: { debut?: string | null } | null;
  }>;
};

function resolveJ1PlannerFilePath(): string {
  const outputDir = path.resolve(__dirname, '../../../../.codex/planning-j1/output');
  const plannerFiles = fs
    .readdirSync(outputDir)
    .filter((file) => /^planning-j1-.*\.json$/i.test(file))
    .sort((a, b) => a.localeCompare(b, 'fr-FR'));
  const plannerFile = plannerFiles[plannerFiles.length - 1];
  if (!plannerFile) {
    throw new Error(`No planning-j1 JSON file found in ${outputDir}`);
  }
  return path.join(outputDir, plannerFile);
}

async function main() {
  const args = process.argv.slice(2);
  const fix = args.includes('--fix');

  if (fix) {
    const plannerPath = resolveJ1PlannerFilePath();
    const planner = JSON.parse(fs.readFileSync(plannerPath, 'utf8')) as J1PlannerFile;
    const j1DateRows = await prisma.$queryRawUnsafe<Array<{ J1_DATE: string | null }>>(
      `SELECT DATE_FORMAT(MIN(DATEHEURE), '%Y-%m-%d') AS J1_DATE
       FROM TA_MATCHS
       WHERE NUM_MATCH BETWEEN 1 AND 24 AND SURFACAGE = 0`,
    );
    const j1Date = j1DateRows[0]?.J1_DATE ?? null;
    if (!j1Date) {
      throw new Error('Unable to resolve J1 SQL date from TA_MATCHS');
    }

    console.log(`Fixing ta_classement.REPAS_SAMEDI from planner ${path.basename(plannerPath)} and CHALLENGE_SAMEDI from ta_equipes...`);
    let rowsUpdated = 0;
    for (const row of planner.planning ?? []) {
      const teamId = Number(row.teamId);
      const repas = row.repas?.debut?.trim() ?? '';
      if (!teamId || !repas) {
        throw new Error(`Invalid planner row for teamId=${row.teamId}`);
      }
      rowsUpdated += Number(
        await prisma.$executeRawUnsafe(
          `UPDATE ta_classement c
           JOIN ta_equipes e ON e.ID = c.EQUIPE_ID
           SET c.REPAS_SAMEDI = ?,
               c.CHALLENGE_SAMEDI = e.CHALLENGE_SAMEDI
           WHERE c.GROUPE_NOM IN ('A','B','C','D') AND c.EQUIPE_ID = ?`,
          `${j1Date} ${repas}:00`,
          teamId,
        ),
      );
    }
    console.log(`Updated ${rowsUpdated} rows.`);
  }

  console.log('\n=== ta_classement J1 après fix ===');
  const classement = await prisma.$queryRawUnsafe<any[]>(
    `SELECT GROUPE_NOM, ORDRE, EQUIPE, EQUIPE_ID,
       DATE_FORMAT(REPAS_SAMEDI,'%H:%i') AS REPAS,
       DATE_FORMAT(CHALLENGE_SAMEDI,'%H:%i') AS CHALLENGE
     FROM ta_classement WHERE GROUPE_NOM IN ('A','B','C','D') ORDER BY GROUPE_NOM, ORDRE`
  );
  console.table(classement);

  if (!fix) {
    console.log('\nRun with --fix to apply the correction.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
