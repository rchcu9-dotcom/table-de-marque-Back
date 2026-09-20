// Vérification EN LECTURE SEULE du schéma de la base de TEST (CA1-CA3) et
// inventaire des autres migrations (CA10). Aucune écriture.
//
// Usage : npx tsx scripts/table-de-marque-test-db/verify-schema.ts --target=rchcu11_tournoi_test
import * as fs from 'fs';
import * as path from 'path';
import type { PrismaClient } from '@prisma/client';
import { openGuardedClient, runMain } from './guard';
import { EXPECTED_SCHEMA, extractIdentifiers } from './lib';

export const TABLE_DE_MARQUE_MIGRATION = '20260904000001_table_de_marque_match_live';
export const MIGRATIONS_DIR = path.resolve(__dirname, '../../prisma/migrations');

export interface Check {
  label: string;
  ok: boolean;
  detail?: string;
  /** Écart signalé sans échec de parité (ex. FK supplémentaire issue de schema.prisma). */
  warn?: boolean;
}

export type MigrationStatus = 'présente' | 'partielle' | 'absente' | 'non vérifiable';

export interface MigrationInventory {
  migration: string;
  status: MigrationStatus;
  missing: string[];
}

interface ColumnRow {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

async function query<T>(prisma: PrismaClient, sql: string, ...params: unknown[]): Promise<T[]> {
  return prisma.$queryRawUnsafe<T[]>(sql, ...params);
}

async function tableExists(prisma: PrismaClient, table: string): Promise<boolean> {
  const rows = await query<{ n: bigint | number }>(
    prisma,
    `SELECT COUNT(*) AS n FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?`,
    table,
  );
  return Number(rows[0].n) > 0;
}

async function columnsOf(prisma: PrismaClient, table: string): Promise<ColumnRow[]> {
  return query<ColumnRow>(
    prisma,
    `SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type, IS_NULLABLE AS is_nullable
       FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ?
      ORDER BY ORDINAL_POSITION`,
    table,
  );
}

async function foreignKeysOf(prisma: PrismaClient, table: string) {
  return query<{ column_name: string; ref_table: string; ref_column: string }>(
    prisma,
    `SELECT COLUMN_NAME AS column_name, REFERENCED_TABLE_NAME AS ref_table,
            REFERENCED_COLUMN_NAME AS ref_column
       FROM information_schema.key_column_usage
      WHERE table_schema = DATABASE() AND table_name = ?
        AND REFERENCED_TABLE_NAME IS NOT NULL`,
    table,
  );
}

async function primaryKeyOf(prisma: PrismaClient, table: string): Promise<string[]> {
  const rows = await query<{ column_name: string }>(
    prisma,
    `SELECT COLUMN_NAME AS column_name
       FROM information_schema.key_column_usage
      WHERE table_schema = DATABASE() AND table_name = ? AND CONSTRAINT_NAME = 'PRIMARY'
      ORDER BY ORDINAL_POSITION`,
    table,
  );
  return rows.map((r) => r.column_name);
}

/** CA1, CA2, CA3 : structure attendue de la brique table de marque. */
export async function verifySchema(prisma: PrismaClient): Promise<{ ok: boolean; checks: Check[] }> {
  const checks: Check[] = [];
  const push = (label: string, ok: boolean, detail?: string, warn = false) =>
    checks.push({ label, ok, detail, warn });

  for (const [table, expected] of Object.entries(EXPECTED_SCHEMA.tables)) {
    if (!(await tableExists(prisma, table))) {
      push(`${table} : table présente`, false, 'absente');
      continue;
    }
    push(`${table} : table présente`, true);

    const actual = await columnsOf(prisma, table);
    const byName = new Map(actual.map((c) => [c.column_name, c]));
    for (const col of expected.columns) {
      const found = byName.get(col.name);
      const ok =
        !!found &&
        found.data_type.toLowerCase() === col.type &&
        (found.is_nullable === 'YES') === col.nullable;
      push(
        `${table}.${col.name} : ${col.type}${col.nullable ? ' NULL' : ' NOT NULL'}`,
        ok,
        ok ? undefined : found ? `constaté ${found.data_type} / nullable=${found.is_nullable}` : 'colonne absente',
      );
    }
    const extra = actual.filter((c) => !expected.columns.some((e) => e.name === c.column_name));
    if (extra.length > 0) {
      push(`${table} : aucune colonne inattendue`, false, extra.map((c) => c.column_name).join(', '));
    }

    const pk = await primaryKeyOf(prisma, table);
    push(
      `${table} : clé primaire (${expected.primaryKey.join(', ')})`,
      JSON.stringify(pk) === JSON.stringify(expected.primaryKey),
      `constaté (${pk.join(', ')})`,
    );

    const fks = await foreignKeysOf(prisma, table);
    for (const fk of expected.foreignKeys) {
      const ok = fks.some(
        (f) => f.column_name === fk.column && f.ref_table === fk.refTable && f.ref_column === fk.refColumn,
      );
      push(`${table} : FK ${fk.column} → ${fk.refTable}.${fk.refColumn}`, ok);
    }
    // FK au-delà de celles de migration.sql (typiquement créées par `prisma db push` d'après
    // les relations de schema.prisma) : écart documenté, non bloquant pour les tables match_*.
    const extraFks = fks.filter(
      (f) => !expected.foreignKeys.some((e) => e.column === f.column_name && e.refTable === f.ref_table),
    );
    if (extraFks.length > 0) {
      push(
        `${table} : FK supplémentaires hors migration.sql`,
        true,
        extraFks.map((f) => `${f.column_name} → ${f.ref_table}.${f.ref_column}`).join(', '),
        true,
      );
    }
  }

  // CA2 : ta_equipes.EQUIPE_REF_ID nullable, sans FK en base.
  const taCol = EXPECTED_SCHEMA.taEquipesColumn;
  const taColumns = await columnsOf(prisma, 'ta_equipes');
  const ref = taColumns.find((c) => c.column_name === taCol.name);
  push(
    `ta_equipes.${taCol.name} : ${taCol.type} NULL`,
    !!ref && ref.data_type.toLowerCase() === taCol.type && ref.is_nullable === 'YES',
    ref ? undefined : 'colonne absente (ta_equipes rechargée par l\'import ? rejouer apply-migration)',
  );
  const taFks = (await foreignKeysOf(prisma, 'ta_equipes')).filter((f) => f.column_name === taCol.name);
  push(
    `ta_equipes.${taCol.name} : aucune FK en base (CA2)`,
    taFks.length === 0,
    taFks.map((f) => `${f.column_name} → ${f.ref_table}.${f.ref_column}`).join(', ') +
      ' — contraire à migration.sql : un rechargement de ta_equipes par l\'import externe peut échouer',
  );

  // CA3 : seed des types de pénalité.
  if (await tableExists(prisma, 'match_types_penalite')) {
    const rows = await query<{ code: string; duree: number }>(
      prisma,
      'SELECT `code` AS code, `duree_minutes_defaut` AS duree FROM `match_types_penalite`',
    );
    for (const seed of EXPECTED_SCHEMA.seed) {
      const found = rows.find((r) => r.code === seed.code);
      push(
        `match_types_penalite : ${seed.code} (${seed.dureeMinutesDefaut} min)`,
        !!found && Number(found.duree) === seed.dureeMinutesDefaut,
        found ? `constaté ${found.duree} min` : 'ligne absente',
      );
    }
  }

  return { ok: checks.every((c) => c.ok), checks };
}

/** CA10 : présence des objets créés par chaque migration versionnée (signalement, jamais correction). */
export async function inventoryMigrations(prisma: PrismaClient): Promise<MigrationInventory[]> {
  const dirs = fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const inventory: MigrationInventory[] = [];
  for (const dir of dirs) {
    const file = path.join(MIGRATIONS_DIR, dir, 'migration.sql');
    if (!fs.existsSync(file)) continue;
    const ids = extractIdentifiers(fs.readFileSync(file, 'utf8'));

    const missing: string[] = [];
    let checked = 0;

    for (const table of ids.tables) {
      checked++;
      if (!(await tableExists(prisma, table))) missing.push(`table ${table}`);
    }
    for (const [table, columns] of Object.entries(ids.columns)) {
      if (!(await tableExists(prisma, table))) {
        if (!ids.tables.includes(table)) missing.push(`table ${table} (colonnes ${columns.join(', ')})`);
        continue;
      }
      const actual = new Set((await columnsOf(prisma, table)).map((c) => c.column_name));
      for (const column of columns) {
        checked++;
        if (!actual.has(column)) missing.push(`colonne ${table}.${column}`);
      }
    }
    for (const mod of ids.modified) {
      checked++;
      const col = (await columnsOf(prisma, mod.table)).find((c) => c.column_name === mod.column);
      if (!col || (col.is_nullable === 'YES') !== mod.nullable) {
        missing.push(`colonne ${mod.table}.${mod.column} (nullable=${mod.nullable} attendu)`);
      }
    }

    const status: MigrationStatus =
      checked === 0 ? 'non vérifiable' : missing.length === 0 ? 'présente' : missing.length === checked ? 'absente' : 'partielle';
    inventory.push({ migration: dir, status, missing });
  }
  return inventory;
}

export function printChecks(checks: Check[]): void {
  for (const c of checks) {
    const tag = c.warn ? 'WARN' : c.ok ? 'OK' : 'KO';
    console.log(`  [${tag}] ${c.label}${(!c.ok || c.warn) && c.detail ? ` — ${c.detail}` : ''}`);
  }
}

export function printInventory(inventory: MigrationInventory[]): void {
  for (const item of inventory) {
    console.log(`  ${item.status.padEnd(15)} ${item.migration}`);
    for (const m of item.missing) console.log(`      manque : ${m}`);
  }
}

if (require.main === module) {
  runMain(async () => {
    const { prisma } = await openGuardedClient(process.argv.slice(2));
    try {
      console.log('\nSchéma de la brique table de marque (lecture seule) :');
      const report = await verifySchema(prisma);
      printChecks(report.checks);

      console.log('\nInventaire des migrations versionnées (signalement uniquement) :');
      printInventory(await inventoryMigrations(prisma));

      console.log(`\nRésultat : ${report.ok ? 'PARITÉ OK' : 'ÉCARTS DÉTECTÉS'}`);
      return report.ok ? 0 : 1;
    } finally {
      await prisma.$disconnect();
    }
  });
}
