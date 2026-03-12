import { PrismaClient } from '@prisma/client';

async function tableExists(prisma: PrismaClient, table: string): Promise<boolean> {
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

export async function resetPreTournament(): Promise<ResetResult> {
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
    await prisma.$transaction(async (tx) => {
      const teams = await tx.$queryRawUnsafe<Array<{ ID: number; EQUIPE: string }>>(
        'SELECT ID, EQUIPE FROM ta_equipes ORDER BY ID',
      );
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

      await tx.$executeRawUnsafe(
        "DELETE FROM ta_classement WHERE GROUPE_NOM IN ('A','B','C','D','1','2','3','4')",
      );
      touched.push('ta_classement');

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

      if (await tableExists(prisma, 'ta_challenge_attempts')) {
        await tx.$executeRawUnsafe('DELETE FROM ta_challenge_attempts');
        touched.push('ta_challenge_attempts');
      }
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
