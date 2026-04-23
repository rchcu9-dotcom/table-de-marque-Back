/**
 * Rebuild J2 matches (25-116) in TA_MATCHS by applying alias translation
 * from seed (A1-D4) to current DB aliases (E1-H4).
 * J1 matches (1-24) are untouched.
 */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

// Translation: seed alias → current J2 alias
const T: Record<string, string> = {
  A1:'E1', A2:'E2', A3:'E3', A4:'E4',
  B1:'F1', B2:'F2', B3:'F3', B4:'F4',
  C1:'G1', C2:'G2', C3:'G3', C4:'G4',
  D1:'H1', D2:'H2', D3:'H3', D4:'H4',
};

// J2 5v5 from seed (matches 25-48)
const j2_5v5: [number, string, string, string][] = [
  [25, 'A1','A4','2026-05-24 09:00:00'],
  [26, 'A2','A3','2026-05-24 09:27:00'],
  [27, 'B2','B4','2026-05-24 09:54:00'],
  [28, 'B3','B1','2026-05-24 10:21:00'],
  [29, 'C1','C4','2026-05-24 11:04:00'],
  [30, 'C2','C3','2026-05-24 11:31:00'],
  [31, 'D1','D3','2026-05-24 11:58:00'],
  [32, 'D4','D2','2026-05-24 12:25:00'],
  [33, 'B4','B1','2026-05-24 13:08:00'],
  [34, 'B3','B2','2026-05-24 13:35:00'],
  [35, 'A1','A3','2026-05-24 14:02:00'],
  [36, 'A4','A2','2026-05-24 14:29:00'],
  [37, 'D1','D2','2026-05-24 15:12:00'],
  [38, 'D4','D3','2026-05-24 15:39:00'],
  [39, 'C1','C3','2026-05-24 16:06:00'],
  [40, 'C2','C4','2026-05-24 16:33:00'],
  [41, 'B2','B1','2026-05-24 17:16:00'],
  [42, 'A1','A2','2026-05-24 17:43:00'],
  [43, 'B4','B3','2026-05-24 18:10:00'],
  [44, 'A4','A3','2026-05-24 18:37:00'],
  [45, 'D1','D4','2026-05-24 19:20:00'],
  [46, 'C3','C4','2026-05-24 19:47:00'],
  [47, 'C1','C2','2026-05-24 20:14:00'],
  [48, 'D4','D2','2026-05-24 20:41:00'],
];

// J2 3v3 from seed (matches 101-116)
const j2_3v3: [number, string, string, string][] = [
  [101, 'A2','C3','2026-05-24 09:30:00'],
  [102, 'C3','D1','2026-05-24 10:00:00'],
  [103, 'D1','D3','2026-05-24 10:30:00'],
  [104, 'D3','A1','2026-05-24 11:00:00'],
  [105, 'A1','B3','2026-05-24 14:30:00'],
  [106, 'B3','B1','2026-05-24 15:00:00'],
  [107, 'B1','A3','2026-05-24 15:30:00'],
  [108, 'A3','B2','2026-05-24 16:00:00'],
  [109, 'B2','A4','2026-05-24 16:30:00'],
  [110, 'A4','C1','2026-05-24 17:00:00'],
  [111, 'C1','B4','2026-05-24 17:30:00'],
  [112, 'B4','C2','2026-05-24 18:00:00'],
  [113, 'C2','C4','2026-05-24 18:30:00'],
  [114, 'C4','D2','2026-05-24 19:00:00'],
  [115, 'D2','D4','2026-05-24 19:30:00'],
  [116, 'D4','A2','2026-05-24 20:00:00'],
];

async function main() {
  const all = [...j2_5v5, ...j2_3v3];
  let updated = 0;

  for (const [num, e1, e2, dt] of all) {
    const n = await db.$executeRawUnsafe(
      `UPDATE TA_MATCHS SET EQUIPE1=?, EQUIPE2=?, DATEHEURE=? WHERE NUM_MATCH=?`,
      T[e1], T[e2], dt, num
    );
    updated += Number(n);
  }

  console.log(`${updated} matchs mis à jour.`);

  // Verify
  const rows = await db.$queryRawUnsafe<any[]>(
    `SELECT NUM_MATCH, EQUIPE1, EQUIPE2, DATE_FORMAT(DATEHEURE,'%H:%i') AS H
     FROM TA_MATCHS WHERE DATE(DATEHEURE)='2026-05-24' ORDER BY NUM_MATCH`
  );
  console.table(rows);
}

main().catch(console.error).finally(() => db.$disconnect());
