import { PrismaClient } from '@prisma/client';
const srcUrl = process.env.DATABASE_URL!;
const dstUrl = srcUrl.replace('rchcu11_tournoi_test', 'rchcu11_tournoi');
const src = new PrismaClient({ datasources: { db: { url: srcUrl } } });
const dst = new PrismaClient({ datasources: { db: { url: dstUrl } } });

async function main() {
  // Get CREATE TABLE from test DB
  const createRows = await src.$queryRawUnsafe<any[]>(`SHOW CREATE TABLE ta_partenaires`);
  const createSql: string = createRows[0]['Create Table'];
  console.log('Schema:', createSql.slice(0, 200));

  // Create in prod (ignore if exists)
  await dst.$executeRawUnsafe(createSql.replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS'));
  console.log('Table created in prod ✓');

  // Clone data
  const rows = await src.$queryRawUnsafe<any[]>(`SELECT * FROM ta_partenaires`);
  console.log(`${rows.length} partenaires à copier`);
  if (rows.length > 0) {
    await dst.$executeRawUnsafe(`TRUNCATE TABLE ta_partenaires`);
    const cols = Object.keys(rows[0]);
    const colList = cols.map(c => `\`${c}\``).join(', ');
    const placeholders = rows.map(() => `(${cols.map(() => '?').join(', ')})`).join(', ');
    const values = rows.flatMap(r => cols.map(c => r[c] ?? null));
    await dst.$executeRawUnsafe(
      `INSERT INTO ta_partenaires (${colList}) VALUES ${placeholders}`,
      ...values
    );
    console.log('Données copiées ✓');
    const check = await dst.$queryRawUnsafe<any[]>(`SELECT id, nom, actif FROM ta_partenaires`);
    console.table(check);
  }
}
main().catch(console.error).finally(async () => { await src.$disconnect(); await dst.$disconnect(); });
