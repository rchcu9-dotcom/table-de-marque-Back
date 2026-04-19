/**
 * Creates ta_cache_snapshots table on both test and prod DBs.
 */
import { PrismaClient } from '@prisma/client';

const testUrl = process.env.DATABASE_URL!;
const prodUrl = testUrl.replace('rchcu11_tournoi_test', 'rchcu11_tournoi');

const SQL = `
CREATE TABLE IF NOT EXISTS \`ta_cache_snapshots\` (
  \`id\`           INT          NOT NULL AUTO_INCREMENT,
  \`snapshot_key\` VARCHAR(64)  NOT NULL,
  \`data\`         LONGTEXT     NOT NULL,
  \`updated_at\`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uq_snapshot_key\` (\`snapshot_key\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

async function apply(label: string, url: string) {
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    await db.$executeRawUnsafe(SQL);
    console.log(`${label}: ta_cache_snapshots created (or already exists) ✓`);
  } finally {
    await db.$disconnect();
  }
}

async function main() {
  await apply('TEST', testUrl);
  await apply('PROD', prodUrl);
}

main().catch((err) => { console.error(err); process.exit(1); });
