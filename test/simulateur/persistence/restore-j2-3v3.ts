/**
 * Restore J2 3v3 matches (101-116) using J1-based aliases with space (ex: "A 1", "C 4").
 * Translation from E-H (old J2 group aliases) to A-D (J1 seeding aliases) :
 *   E1=A1, E2=B1, E3=C2, E4=D2
 *   F1=C1, F2=D1, F3=A2, F4=B2
 *   G1=A3, G2=B3, G3=C4, G4=D4
 *   H1=C3, H2=D3, H3=A4, H4=B4
 */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const matches: [number, string, string, string][] = [
  [101, 'C 3', 'C 4', '2026-05-24 09:30:00'],
  [102, 'C 4', 'D 3', '2026-05-24 10:00:00'],
  [103, 'D 3', 'D 2', '2026-05-24 10:30:00'],
  [104, 'D 2', 'A 1', '2026-05-24 11:00:00'],
  [105, 'A 1', 'D 4', '2026-05-24 14:30:00'],
  [106, 'D 4', 'B 2', '2026-05-24 15:00:00'],
  [107, 'B 2', 'C 1', '2026-05-24 15:30:00'],
  [108, 'C 1', 'C 2', '2026-05-24 16:00:00'],
  [109, 'C 2', 'A 4', '2026-05-24 16:30:00'],
  [110, 'A 4', 'A 3', '2026-05-24 17:00:00'],
  [111, 'A 3', 'B 4', '2026-05-24 17:30:00'],
  [112, 'B 4', 'B 3', '2026-05-24 18:00:00'],
  [113, 'B 3', 'D 1', '2026-05-24 18:30:00'],
  [114, 'D 1', 'A 2', '2026-05-24 19:00:00'],
  [115, 'A 2', 'B 1', '2026-05-24 19:30:00'],
  [116, 'B 1', 'C 3', '2026-05-24 20:00:00'],
];

async function main() {
  let n = 0;
  for (const [num, e1, e2, dt] of matches) {
    n += Number(await db.$executeRawUnsafe(
      `UPDATE TA_MATCHS SET EQUIPE1=?, EQUIPE2=?, DATEHEURE=? WHERE NUM_MATCH=?`,
      e1, e2, dt, num
    ));
  }
  console.log(`${n} matchs 3v3 restaurés.`);
  const rows = await db.$queryRawUnsafe<any[]>(
    `SELECT NUM_MATCH, EQUIPE1, EQUIPE2, DATE_FORMAT(DATEHEURE,'%H:%i') AS H
     FROM TA_MATCHS WHERE NUM_MATCH >= 101 ORDER BY NUM_MATCH`
  );
  console.table(rows);
}

main().catch(console.error).finally(() => db.$disconnect());
