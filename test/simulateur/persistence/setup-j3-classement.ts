/**
 * Set J3 classement aliases (EQUIPE) for groups I/J/K/L.
 * ORDRE = planning slot (1=loser semi1, 2=loser semi2, 3=winner semi1, 4=winner semi2)
 * Semi order = chronological: earliest match = semi1.
 */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const rows: [string, number, string][] = [
  // [GROUPE_NOM, ORDRE, EQUIPE alias]
  // L = Argent 13 — semi1: G3-H4 (match 49), semi2: G4-H3 (match 50)
  ['L', 1, 'Perd. G3-H4'],
  ['L', 2, 'Perd. G4-H3'],
  ['L', 3, 'Vain. G3-H4'],
  ['L', 4, 'Vain. G4-H3'],
  // J = Or 5 — semi1: E3-F4 (match 51), semi2: E4-F3 (match 52)
  ['J', 1, 'Perd. E3-F4'],
  ['J', 2, 'Perd. E4-F3'],
  ['J', 3, 'Vain. E3-F4'],
  ['J', 4, 'Vain. E4-F3'],
  // K = Argent 9 — semi1: G1-H2 (match 53), semi2: G2-H1 (match 54)
  ['K', 1, 'Perd. G1-H2'],
  ['K', 2, 'Perd. G2-H1'],
  ['K', 3, 'Vain. G1-H2'],
  ['K', 4, 'Vain. G2-H1'],
  // I = Or 1 — semi1: E1-F2 (match 55), semi2: E2-F1 (match 56)
  ['I', 1, 'Perd. E1-F2'],
  ['I', 2, 'Perd. E2-F1'],
  ['I', 3, 'Vain. E1-F2'],
  ['I', 4, 'Vain. E2-F1'],
];

async function main() {
  let n = 0;
  for (const [groupe, ordre, equipe] of rows) {
    n += Number(await db.$executeRawUnsafe(
      `UPDATE ta_classement SET EQUIPE = ? WHERE GROUPE_NOM = ? AND ORDRE = ?`,
      equipe, groupe, ordre,
    ));
  }
  console.log(`${n} lignes mises à jour.`);
  const result = await db.$queryRawUnsafe<any[]>(
    `SELECT GROUPE_NOM, ORDRE, ORDRE_FINAL, EQUIPE, DATE_FORMAT(REPAS_LUNDI,'%H:%i') AS RL
     FROM ta_classement WHERE GROUPE_NOM IN ('I','J','K','L') ORDER BY GROUPE_NOM, ORDRE`
  );
  console.table(result);
}

main().catch(console.error).finally(() => db.$disconnect());
