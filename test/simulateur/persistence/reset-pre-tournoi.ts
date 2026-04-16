import fs from 'node:fs';
import path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import type { SimMatch, SimTeam } from '../types';

type PrismaQueryable = Pick<PrismaClient, '$queryRawUnsafe'> | Prisma.TransactionClient;

async function tableExists(prisma: PrismaQueryable, table: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
    'SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
    table,
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

type ResetResult = {
  reset: boolean;
  note: string;
  tables: string[];
  teamsMissingPlayersDetected: number;
  playersInsertedForMissingTeams: number;
  joueursResetRowsAffected: number;
};

type J1PlannerTeamSlot = {
  repasSql: string;
  challengeSql: string;
};

type J1PlannerFile = {
  planning?: Array<{
    teamId: number;
    teamName: string;
    challenge?: { debut?: string | null } | null;
    repas?: { debut?: string | null } | null;
  }>;
};

function resolveJ1PlannerOutputDir(): string {
  return path.resolve(__dirname, '../../../../.codex/planning-j1/output');
}

function combineSqlDateAndTime(sqlDate: string, time: string, label: string, teamId: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sqlDate)) {
    throw new Error(`Invalid SQL date "${sqlDate}" while building ${label} for J1 planner teamId=${teamId}`);
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new Error(`Invalid planner time "${time}" for ${label} teamId=${teamId}`);
  }
  return `${sqlDate} ${time}:00`;
}

function loadJ1PlannerSlots(sqlDate: string): Map<number, J1PlannerTeamSlot> {
  const outputDir = resolveJ1PlannerOutputDir();
  if (!fs.existsSync(outputDir)) {
    throw new Error(`J1 planner output directory not found: ${outputDir}`);
  }

  const plannerFiles = fs
    .readdirSync(outputDir)
    .filter((file) => /^planning-j1-.*\.json$/i.test(file))
    .sort((a, b) => a.localeCompare(b, 'fr-FR'));
  const plannerFile = plannerFiles[plannerFiles.length - 1];
  if (!plannerFile) {
    throw new Error(`No planning-j1 JSON file found in ${outputDir}`);
  }

  const plannerPath = path.join(outputDir, plannerFile);
  const planner = JSON.parse(fs.readFileSync(plannerPath, 'utf8')) as J1PlannerFile;
  const rows = planner.planning ?? [];
  if (rows.length === 0) {
    throw new Error(`Planner file has no team planning rows: ${plannerPath}`);
  }

  const slots = new Map<number, J1PlannerTeamSlot>();
  for (const row of rows) {
    const teamId = Number(row.teamId);
    const repas = row.repas?.debut?.trim() ?? '';
    const challenge = row.challenge?.debut?.trim() ?? '';
    if (!Number.isFinite(teamId) || teamId <= 0) {
      throw new Error(`Invalid teamId in J1 planner: ${JSON.stringify(row)}`);
    }
    if (!repas) {
      throw new Error(`Missing repas.debut in J1 planner for teamId=${teamId}`);
    }
    if (!challenge) {
      throw new Error(`Missing challenge.debut in J1 planner for teamId=${teamId}`);
    }
    if (slots.has(teamId)) {
      throw new Error(`Duplicate teamId=${teamId} in J1 planner ${plannerPath}`);
    }

    slots.set(teamId, {
      repasSql: combineSqlDateAndTime(sqlDate, repas, 'repas', teamId),
      challengeSql: combineSqlDateAndTime(sqlDate, challenge, 'challenge', teamId),
    });
  }

  return slots;
}

type TeamChallengeSyncRow = {
  teamId: number;
  challengeSql: string;
};

type ClassementInsertRow = {
  groupeNom: string;
  ordre: number;
  ordreFinal: number;
  equipe: string;
  equipeId: number;
  repasSamedi: string | null;
  challengeSamedi: string | null;
};

async function syncTeamChallengeSlots(
  tx: Prisma.TransactionClient,
  rows: TeamChallengeSyncRow[],
): Promise<number> {
  if (rows.length === 0) return 0;

  const caseFragments = rows.map(() => 'WHEN ? THEN ?').join(' ');
  const idsPlaceholders = rows.map(() => '?').join(', ');
  const params: Array<string | number> = [];
  rows.forEach((row) => {
    params.push(row.teamId, row.challengeSql);
  });
  rows.forEach((row) => {
    params.push(row.teamId);
  });

  return Number(
    await tx.$executeRawUnsafe(
      `UPDATE ta_equipes
       SET CHALLENGE_SAMEDI = CASE ID ${caseFragments} ELSE CHALLENGE_SAMEDI END
       WHERE ID IN (${idsPlaceholders})`,
      ...params,
    ),
  );
}

async function insertClassementRows(
  tx: Prisma.TransactionClient,
  rows: ClassementInsertRow[],
): Promise<number> {
  if (rows.length === 0) return 0;

  const placeholders = rows
    .map(() => '(?, ?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0, ?, ?)')
    .join(', ');
  const params: Array<string | number | null> = [];
  rows.forEach((row) => {
    params.push(
      row.groupeNom,
      row.ordre,
      row.ordreFinal,
      row.equipe,
      row.equipeId,
      row.repasSamedi,
      row.challengeSamedi,
    );
  });

  return Number(
    await tx.$executeRawUnsafe(
      `INSERT INTO ta_classement (
        GROUPE_NOM, ORDRE, ORDRE_FINAL, EQUIPE, EQUIPE_ID,
        J, V, N, D, PTS, BP, BC, DIFF,
        REPAS_SAMEDI, CHALLENGE_SAMEDI
      ) VALUES ${placeholders}`,
      ...params,
    ),
  );
}

/**
 * Remet EQUIPE1/EQUIPE2 aux valeurs placeholder pour les matchs J2/J3.
 * Nécessaire au début d'une nouvelle simulation si une précédente a déjà
 * résolu les lineups (les vrais noms d'équipes resteraient sinon en DB).
 */
export async function resetMatchPlaceholders(
  matches: SimMatch[],
): Promise<{ rowsAffected: number }> {
  const placeholderMatches = matches.filter(
    (m) => (m.day === 'J2' || m.day === 'J3') && m.placeholderA && m.placeholderB,
  );
  if (placeholderMatches.length === 0) return { rowsAffected: 0 };

  const prisma = new PrismaClient();
  await prisma.$connect();
  let rowsAffected = 0;
  try {
    for (const match of placeholderMatches) {
      const numMatch = Number(match.id.replace('M-', ''));
      const rows = await prisma.$executeRawUnsafe(
        'UPDATE TA_MATCHS SET EQUIPE1 = ?, EQUIPE2 = ? WHERE NUM_MATCH = ?',
        match.placeholderA!,
        match.placeholderB!,
        numMatch,
      );
      rowsAffected += Number(rows);
    }
  } finally {
    await prisma.$disconnect();
  }
  return { rowsAffected };
}

export async function resetPreTournament(j1Teams?: Array<{ team: SimTeam; group: string }>): Promise<ResetResult> {
  const firstNames = [
    'Noah', 'Leo', 'Lucas', 'Ethan', 'Jules', 'Tom', 'Nolan', 'Hugo', 'Sacha', 'Milan',
    'Louis', 'Mathis', 'Enzo', 'Axel', 'Rayan', 'Eli', 'Liam', 'Theo', 'Arthur', 'Max',
  ];
  const lastNames = [
    'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon',
    'Laurent', 'Lefevre', 'Garcia', 'David', 'Roux', 'Fournier', 'Girard', 'Andre', 'Mercier', 'Faure',
  ];

  const prisma = new PrismaClient();
  await prisma.$connect();

  const touched: string[] = [];
  let teamsMissingPlayersDetected = 0;
  let playersInsertedForMissingTeams = 0;
  let joueursResetRowsAffected = 0;

  try {
    const j1DateRows = await prisma.$queryRawUnsafe<Array<{ J1_DATE: string | null }>>(
      `SELECT DATE_FORMAT(MIN(DATEHEURE), '%Y-%m-%d') AS J1_DATE
       FROM TA_MATCHS
       WHERE NUM_MATCH BETWEEN 1 AND 24 AND SURFACAGE = 0`,
    );
    const j1SqlDate = j1DateRows[0]?.J1_DATE ?? null;
    if (!j1SqlDate) {
      throw new Error('Unable to resolve J1 SQL date from TA_MATCHS for reset-pre-tournoi');
    }
    const plannerSlotsByTeamId = loadJ1PlannerSlots(j1SqlDate);

    await prisma.$transaction(async (tx) => {
      const teams = await tx.$queryRawUnsafe<Array<{
        ID: number;
        EQUIPE: string;
        CHALLENGE_SAMEDI: string | null;
      }>>(
        `SELECT ID, EQUIPE,
           DATE_FORMAT(CHALLENGE_SAMEDI, '%Y-%m-%dT%H:%i:%s') AS CHALLENGE_SAMEDI
         FROM ta_equipes ORDER BY ID`,
      );
      const teamChallengeUpdates: TeamChallengeSyncRow[] = [];
      for (const team of teams) {
        const teamId = Number(team.ID);
        const plannerSlot = plannerSlotsByTeamId.get(teamId);
        if (!plannerSlot) {
          throw new Error(`Missing J1 planner slot for teamId=${teamId} (${team.EQUIPE})`);
        }
        const currentChallenge = team.CHALLENGE_SAMEDI ?? null;
        if (currentChallenge !== plannerSlot.challengeSql.replace(' ', 'T')) {
          teamChallengeUpdates.push({
            teamId,
            challengeSql: plannerSlot.challengeSql,
          });
        }
      }
      await syncTeamChallengeSlots(tx, teamChallengeUpdates);
      touched.push('ta_equipes');

      const counts = await tx.$queryRawUnsafe<Array<{ EQUIPE_ID: number; c: number }>>(
        'SELECT EQUIPE_ID, COUNT(*) AS c FROM ta_joueurs GROUP BY EQUIPE_ID',
      );
      const countByTeamId = new Map<number, number>(
        counts.map((row) => [Number(row.EQUIPE_ID), Number(row.c)]),
      );
      const missingTeams = teams.filter((team) => (countByTeamId.get(Number(team.ID)) ?? 0) === 0);
      teamsMissingPlayersDetected = missingTeams.length;

      if (missingTeams.length > 0) {
        const maxIdRows = await tx.$queryRawUnsafe<Array<{ maxId: number | null }>>(
          'SELECT MAX(ID) AS maxId FROM ta_joueurs',
        );
        let nextId = Number(maxIdRows[0]?.maxId ?? 0) + 1;

        for (const team of missingTeams) {
          for (let i = 1; i <= 15; i += 1) {
            const position = i === 15 ? 'G' : i % 2 === 0 ? 'D' : 'A';
            const first = firstNames[(Number(team.ID) + i) % firstNames.length];
            const last = `${team.EQUIPE} ${lastNames[(Number(team.ID) * 7 + i) % lastNames.length]}`;
            await tx.$executeRawUnsafe(
              `INSERT INTO ta_joueurs
                (ID, EQUIPE_ID, NUMERO, POSITION, NOM, PRENOM)
               VALUES (?, ?, ?, ?, ?, ?)`,
              nextId,
              Number(team.ID),
              i,
              position,
              last.slice(0, 50),
              first.slice(0, 50),
            );
            nextId += 1;
            playersInsertedForMissingTeams += 1;
          }
        }
      }

      await tx.$executeRawUnsafe("UPDATE TA_MATCHS SET ETAT = ''");
      await tx.$executeRawUnsafe('UPDATE TA_MATCHS SET SCORE1 = 0, SCORE2 = 0 WHERE SURFACAGE = 0');
      touched.push('TA_MATCHS');

      await tx.$executeRawUnsafe('DELETE FROM ta_classement');
      touched.push('ta_classement');

      if (j1Teams && j1Teams.length > 0) {
        const byGroup = new Map<string, Array<{ team: SimTeam; group: string }>>();
        for (const entry of j1Teams) {
          const list = byGroup.get(entry.group) ?? [];
          list.push(entry);
          byGroup.set(entry.group, list);
        }
        const j1ClassementRows: ClassementInsertRow[] = [];
        for (const [group, entries] of byGroup) {
          for (let i = 0; i < entries.length; i++) {
            const { team } = entries[i];
            const plannerSlot = plannerSlotsByTeamId.get(Number(team.id));
            if (!plannerSlot) {
              throw new Error(`Missing J1 planner slot for classement init teamId=${team.id} (${team.name})`);
            }
            j1ClassementRows.push({
              groupeNom: group,
              ordre: i + 1,
              ordreFinal: i + 1,
              equipe: team.name,
              equipeId: Number(team.id),
              repasSamedi: plannerSlot.repasSql,
              challengeSamedi: plannerSlot.challengeSql,
            });
          }
        }
        await insertClassementRows(tx, j1ClassementRows);
      }

      // J2 standings init — 4 pools cross-J1 (GROUPE_NOM '1'/'2'/'3'/'4')
      // REPAS_SAMEDI = créneaux fixes du planning J2 (planning-j2-2026-05-24.json)
      // EQUIPE_IDs 101–116 : A1=101 A2=102 B1=103 B2=104 C1=105 C2=106 D1=107 D2=108
      //                      A3=109 A4=110 B3=111 B4=112 C3=113 C4=114 D3=115 D4=116
      const j2Rows: Array<[string, number, string, number, string]> = [
        // [groupe, ordre, alias, equipeId, repasSamedi]
        ['1', 1, 'A1', 101, '2026-05-24 11:05:00'],
        ['1', 2, 'A2', 102, '2026-05-24 12:45:00'],
        ['1', 3, 'B1', 103, '2026-05-24 11:50:00'],
        ['1', 4, 'B2', 104, '2026-05-24 12:40:00'],
        ['2', 1, 'C1', 105, '2026-05-24 11:10:00'],
        ['2', 2, 'C2', 106, '2026-05-24 12:30:00'],
        ['2', 3, 'D1', 107, '2026-05-24 12:00:00'],
        ['2', 4, 'D2', 108, '2026-05-24 13:15:00'],
        ['3', 1, 'A3', 109, '2026-05-24 11:15:00'],
        ['3', 2, 'A4', 110, '2026-05-24 13:25:00'],
        ['3', 3, 'B3', 111, '2026-05-24 12:35:00'],
        ['3', 4, 'B4', 112, '2026-05-24 11:45:00'],
        ['4', 1, 'C3', 113, '2026-05-24 11:55:00'],
        ['4', 2, 'C4', 114, '2026-05-24 13:20:00'],
        ['4', 3, 'D3', 115, '2026-05-24 13:30:00'],
        ['4', 4, 'D4', 116, '2026-05-24 11:00:00'],
      ];
      await insertClassementRows(
        tx,
        j2Rows.map(([groupe, ordre, alias, equipeId, repasSamedi]) => ({
          groupeNom: groupe,
          ordre,
          ordreFinal: ordre,
          equipe: alias,
          equipeId,
          repasSamedi,
          challengeSamedi: null,
        })),
      );

      // J3 Phase1 standings init — groupes E (Or) et F (Argent) — pas de repas
      const j3Phase1Rows: Array<[string, number, string, number]> = [
        ['E', 1, 'A1', 101], ['E', 2, 'B1', 103], ['E', 3, 'B2', 104], ['E', 4, 'A2', 102],
        ['E', 5, 'A3', 109], ['E', 6, 'B3', 111], ['E', 7, 'B4', 112], ['E', 8, 'A4', 110],
        ['F', 1, 'C1', 105], ['F', 2, 'D1', 107], ['F', 3, 'D2', 108], ['F', 4, 'C2', 106],
        ['F', 5, 'C3', 113], ['F', 6, 'D3', 115], ['F', 7, 'D4', 116], ['F', 8, 'C4', 114],
      ];
      await insertClassementRows(
        tx,
        j3Phase1Rows.map(([groupe, ordre, alias, equipeId]) => ({
          groupeNom: groupe,
          ordre,
          ordreFinal: ordre,
          equipe: alias,
          equipeId,
          repasSamedi: null,
          challengeSamedi: null,
        })),
      );

      // J3 Phase2 standings init — groupes G (Losers) et J (Winners)
      // REPAS_SAMEDI = créneaux fixes du planning J3 (planning-j3-2026-05-25.json)
      // EQUIPE_IDs 201–208 losers, 209–216 winners
      const j3Phase2Rows: Array<[string, number, string, number, string]> = [
        ['G', 1, 'pA1B2', 201, '2026-05-25 11:45:00'],
        ['G', 2, 'pB1A2', 202, '2026-05-25 12:00:00'],
        ['G', 3, 'pA3B4', 203, '2026-05-25 13:25:00'],
        ['G', 4, 'pB3A4', 204, '2026-05-25 13:20:00'],
        ['G', 5, 'pC1D2', 205, '2026-05-25 13:30:00'],
        ['G', 6, 'pD1C2', 206, '2026-05-25 13:15:00'],
        ['G', 7, 'pC3D4', 207, '2026-05-25 11:10:00'],
        ['G', 8, 'pD3C4', 208, '2026-05-25 11:00:00'],
        ['J', 1, 'vA1B2', 209, '2026-05-25 12:30:00'],
        ['J', 2, 'vB1A2', 210, '2026-05-25 12:40:00'],
        ['J', 3, 'vA3B4', 211, '2026-05-25 11:15:00'],
        ['J', 4, 'vB3A4', 212, '2026-05-25 11:50:00'],
        ['J', 5, 'vC1D2', 213, '2026-05-25 12:45:00'],
        ['J', 6, 'vD1C2', 214, '2026-05-25 11:55:00'],
        ['J', 7, 'vC3D4', 215, '2026-05-25 12:35:00'],
        ['J', 8, 'vD3C4', 216, '2026-05-25 11:05:00'],
      ];
      await insertClassementRows(
        tx,
        j3Phase2Rows.map(([groupe, ordre, alias, equipeId, repasSamedi]) => ({
          groupeNom: groupe,
          ordre,
          ordreFinal: ordre,
          equipe: alias,
          equipeId,
          repasSamedi,
          challengeSamedi: null,
        })),
      );

      joueursResetRowsAffected = Number(
        await tx.$executeRawUnsafe(
          `UPDATE ta_joueurs SET
            TEMPS_SLALOM = '0:00:00:000',
            TIME_SLALOM = 0,
            NB_PORTES = 0,
            TEMPS_VITESSE = '0:00:00:000',
            TIME_VITESSE = 0,
            TIR1 = NULL,
            TIR2 = NULL,
            TIR3 = NULL,
            TEMPS_TOTAL = '0:00:00:000',
            TIME_TOTAL = 0,
            QF = NULL,
            DF = NULL,
            F = NULL,
            V = NULL,
            GARDIEN_NB_BUT = 0,
            GARDIEN_TEMPS_ATELIER = '0:00:00:000',
            GARDIEN_TIME_ATELIER = 0,
            GARDIEN_TEMPS_VITESSE = '0:00:00:000',
            GARDIEN_TIME_VITESSE = 0,
            GARDIEN_TEMPS_TOTAL = '0:00:00:000',
            GARDIEN_TIME_TOTAL = 0,
            GARDIEN_DF = NULL,
            GARDIEN_F = NULL,
            GARDIEN_V = NULL`,
        ),
      );
      touched.push('ta_joueurs');

      if (await tableExists(tx, 'ta_challenge_attempts')) {
        await tx.$executeRawUnsafe('DELETE FROM ta_challenge_attempts');
        touched.push('ta_challenge_attempts');
      }
    }, {
      maxWait: 10_000,
      timeout: 30_000,
    });

    return {
      reset: true,
      note: 'Pre-tournament reset applied on DB target.',
      tables: touched,
      teamsMissingPlayersDetected,
      playersInsertedForMissingTeams,
      joueursResetRowsAffected,
    };
  } finally {
    await prisma.$disconnect();
  }
}
