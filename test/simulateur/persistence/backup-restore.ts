import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

type MatchStateRow = {
  NUM_MATCH: number;
  ETAT: string;
  SCORE1: number | null;
  SCORE2: number | null;
};

type ClassementStateRow = {
  GROUPE_NOM: string;
  EQUIPE_ID: number;
  J: number;
  V: number;
  N: number;
  D: number;
  PTS: number;
  BP: number;
  BC: number;
  DIFF: number;
};

type JoueurStateRow = {
  ID: number;
  QF: string | null;
  DF: string | null;
  F: string | null;
  V: string | null;
  GARDIEN_DF: string | null;
  GARDIEN_F: string | null;
  GARDIEN_V: string | null;
};

type ChallengeAttemptRow = {
  ID: number;
  PLAYER_ID: number;
  TEAM_ID: number;
  ATELIER: string;
  RESULTAT: number;
  META: string | null;
};

type BackupPayload = {
  createdAt: string;
  database: string;
  tables: {
    TA_MATCHS: MatchStateRow[];
    ta_classement: ClassementStateRow[];
    ta_joueurs: JoueurStateRow[];
    ta_challenge_attempts?: ChallengeAttemptRow[];
  };
};

async function tableExists(prisma: PrismaClient, table: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
    'SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
    table,
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

export async function createBackup(filePath: string): Promise<{ filePath: string; tableCounts: Record<string, number> }> {
  const prisma = new PrismaClient();
  await prisma.$connect();
  try {
    const db = await prisma.$queryRawUnsafe<Array<{ db: string }>>('SELECT DATABASE() AS db');
    const payload: BackupPayload = {
      createdAt: new Date().toISOString(),
      database: db[0]?.db ?? '',
      tables: {
        TA_MATCHS: await prisma.$queryRawUnsafe<MatchStateRow[]>(
          'SELECT NUM_MATCH, ETAT, SCORE1, SCORE2 FROM TA_MATCHS',
        ),
        ta_classement: await prisma.$queryRawUnsafe<ClassementStateRow[]>(
          'SELECT GROUPE_NOM, EQUIPE_ID, J, V, N, D, PTS, BP, BC, DIFF FROM ta_classement',
        ),
        ta_joueurs: await prisma.$queryRawUnsafe<JoueurStateRow[]>(
          'SELECT ID, QF, DF, F, V, GARDIEN_DF, GARDIEN_F, GARDIEN_V FROM ta_joueurs',
        ),
      },
    };

    if (await tableExists(prisma, 'ta_challenge_attempts')) {
      payload.tables.ta_challenge_attempts = await prisma.$queryRawUnsafe<ChallengeAttemptRow[]>(
        'SELECT ID, PLAYER_ID, TEAM_ID, ATELIER, RESULTAT, META FROM ta_challenge_attempts',
      );
    }

    const tableCounts: Record<string, number> = {
      TA_MATCHS: payload.tables.TA_MATCHS.length,
      ta_classement: payload.tables.ta_classement.length,
      ta_joueurs: payload.tables.ta_joueurs.length,
    };
    if (payload.tables.ta_challenge_attempts) {
      tableCounts.ta_challenge_attempts = payload.tables.ta_challenge_attempts.length;
    }

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return { filePath, tableCounts };
  } finally {
    await prisma.$disconnect();
  }
}

export async function restoreBackup(filePath: string): Promise<void> {
  const raw = fs.readFileSync(filePath, 'utf8');
  const payload = JSON.parse(raw) as BackupPayload;
  const prisma = new PrismaClient();
  await prisma.$connect();

  try {
    await prisma.$transaction(async (tx) => {
      for (const row of payload.tables.TA_MATCHS) {
        await tx.$executeRawUnsafe(
          'UPDATE TA_MATCHS SET ETAT = ?, SCORE1 = ?, SCORE2 = ? WHERE NUM_MATCH = ?',
          row.ETAT,
          row.SCORE1,
          row.SCORE2,
          row.NUM_MATCH,
        );
      }

      for (const row of payload.tables.ta_classement) {
        await tx.$executeRawUnsafe(
          'UPDATE ta_classement SET J = ?, V = ?, N = ?, D = ?, PTS = ?, BP = ?, BC = ?, DIFF = ? WHERE GROUPE_NOM = ? AND EQUIPE_ID = ?',
          row.J,
          row.V,
          row.N,
          row.D,
          row.PTS,
          row.BP,
          row.BC,
          row.DIFF,
          row.GROUPE_NOM,
          row.EQUIPE_ID,
        );
      }

      for (const row of payload.tables.ta_joueurs) {
        await tx.$executeRawUnsafe(
          'UPDATE ta_joueurs SET QF = ?, DF = ?, F = ?, V = ?, GARDIEN_DF = ?, GARDIEN_F = ?, GARDIEN_V = ? WHERE ID = ?',
          row.QF,
          row.DF,
          row.F,
          row.V,
          row.GARDIEN_DF,
          row.GARDIEN_F,
          row.GARDIEN_V,
          row.ID,
        );
      }

      if (payload.tables.ta_challenge_attempts) {
        await tx.$executeRawUnsafe('DELETE FROM ta_challenge_attempts');
        for (const row of payload.tables.ta_challenge_attempts) {
          await tx.$executeRawUnsafe(
            'INSERT INTO ta_challenge_attempts (ID, PLAYER_ID, TEAM_ID, ATELIER, RESULTAT, META) VALUES (?, ?, ?, ?, ?, ?)',
            row.ID,
            row.PLAYER_ID,
            row.TEAM_ID,
            row.ATELIER,
            row.RESULTAT,
            row.META,
          );
        }
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}
