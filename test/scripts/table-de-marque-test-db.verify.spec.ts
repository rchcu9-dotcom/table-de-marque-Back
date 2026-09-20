import * as fs from 'fs';
import * as path from 'path';
import type { PrismaClient } from '@prisma/client';
import {
  inventoryMigrations,
  printChecks,
  printInventory,
  verifySchema,
} from '../../scripts/table-de-marque-test-db/verify-schema';
import { EXPECTED_SCHEMA, extractIdentifiers } from '../../scripts/table-de-marque-test-db/lib';

// ── Fausse base : simule information_schema à partir d'un « monde » modifiable ──

interface FakeColumn {
  name: string;
  type: string;
  nullable: boolean;
}
interface FakeFk {
  table: string;
  column: string;
  refTable: string;
  refColumn: string;
}
interface World {
  tables: Map<string, FakeColumn[]>;
  primaryKeys: Map<string, string[]>;
  fks: FakeFk[];
  seed: { code: string; duree: number }[];
}

function baseWorld(): World {
  const tables = new Map<string, FakeColumn[]>();
  const primaryKeys = new Map<string, string[]>();
  const fks: FakeFk[] = [];
  for (const [name, def] of Object.entries(EXPECTED_SCHEMA.tables)) {
    tables.set(name, def.columns.map((c) => ({ name: c.name, type: c.type, nullable: c.nullable })));
    primaryKeys.set(name, [...def.primaryKey]);
    for (const fk of def.foreignKeys) fks.push({ table: name, ...fk });
  }
  const ta = EXPECTED_SCHEMA.taEquipesColumn;
  tables.set('ta_equipes', [
    { name: 'ID', type: 'int', nullable: false },
    { name: ta.name, type: ta.type, nullable: ta.nullable },
  ]);
  return {
    tables,
    primaryKeys,
    fks,
    seed: EXPECTED_SCHEMA.seed.map((s) => ({ code: s.code, duree: s.dureeMinutesDefaut })),
  };
}

function fakePrisma(world: World): PrismaClient {
  const queryRawUnsafe = async (sql: string, ...params: unknown[]) => {
    const table = params[0] as string;
    if (sql.includes('FROM information_schema.tables')) {
      return [{ n: world.tables.has(table) ? 1 : 0 }];
    }
    if (sql.includes('FROM information_schema.columns')) {
      return (world.tables.get(table) ?? []).map((c) => ({
        column_name: c.name,
        data_type: c.type.toUpperCase(),
        is_nullable: c.nullable ? 'YES' : 'NO',
      }));
    }
    if (sql.includes("CONSTRAINT_NAME = 'PRIMARY'")) {
      return (world.primaryKeys.get(table) ?? []).map((c) => ({ column_name: c }));
    }
    if (sql.includes('REFERENCED_TABLE_NAME IS NOT NULL')) {
      return world.fks
        .filter((f) => f.table === table)
        .map((f) => ({ column_name: f.column, ref_table: f.refTable, ref_column: f.refColumn }));
    }
    if (sql.includes('FROM `match_types_penalite`')) {
      return world.seed;
    }
    throw new Error(`requête non prévue par la fausse base : ${sql.slice(0, 60)}`);
  };
  return { $queryRawUnsafe: queryRawUnsafe } as unknown as PrismaClient;
}

const failing = (checks: { ok: boolean; label: string }[]) => checks.filter((c) => !c.ok).map((c) => c.label);

describe('verifySchema', () => {
  it('parité OK sur un schéma conforme à migration.sql, sans aucun avertissement', async () => {
    const report = await verifySchema(fakePrisma(baseWorld()));

    expect(report.ok).toBe(true);
    expect(failing(report.checks)).toEqual([]);
    expect(report.checks.some((c) => c.warn)).toBe(false);
    // 4 tables + colonnes + PK + FK + colonne ta_equipes + absence de FK + 3 seeds
    expect(report.checks.length).toBeGreaterThan(40);
  });

  it.each(Object.keys(EXPECTED_SCHEMA.tables))('KO quand la table %s est absente', async (table) => {
    const world = baseWorld();
    world.tables.delete(table);

    const report = await verifySchema(fakePrisma(world));

    expect(report.ok).toBe(false);
    expect(failing(report.checks)).toContain(`${table} : table présente`);
  });

  it('KO sur un mauvais type de colonne', async () => {
    const world = baseWorld();
    world.tables.get('match_live')!.find((c) => c.name === 'score1_cache')!.type = 'varchar';

    const report = await verifySchema(fakePrisma(world));

    expect(report.ok).toBe(false);
    expect(failing(report.checks)).toContain('match_live.score1_cache : int NOT NULL');
  });

  it('KO sur une nullabilité différente', async () => {
    const world = baseWorld();
    world.tables.get('match_buts')!.find((c) => c.name === 'assist1_id')!.nullable = false;

    const report = await verifySchema(fakePrisma(world));

    expect(failing(report.checks)).toContain('match_buts.assist1_id : int NULL');
  });

  it('KO sur une colonne manquante et sur une colonne inattendue', async () => {
    const world = baseWorld();
    world.tables.set(
      'match_penalites',
      world.tables.get('match_penalites')!.filter((c) => c.name !== 'duree_minutes').concat({ name: 'parasite', type: 'int', nullable: true }),
    );

    const report = await verifySchema(fakePrisma(world));

    expect(failing(report.checks)).toEqual(
      expect.arrayContaining(['match_penalites.duree_minutes : int NOT NULL', 'match_penalites : aucune colonne inattendue']),
    );
  });

  it('KO sur une clé primaire incorrecte', async () => {
    const world = baseWorld();
    world.primaryKeys.set('match_live', ['etat']);

    const report = await verifySchema(fakePrisma(world));

    expect(failing(report.checks)).toContain('match_live : clé primaire (num_match)');
  });

  it('KO quand une FK exigée de migration.sql manque', async () => {
    const world = baseWorld();
    world.fks = world.fks.filter((f) => !(f.table === 'match_penalites' && f.column === 'type_penalite_code'));

    const report = await verifySchema(fakePrisma(world));

    expect(failing(report.checks)).toContain('match_penalites : FK type_penalite_code → match_types_penalite.code');
  });

  it('WARN (non bloquant) pour des FK supplémentaires sur match_buts / match_penalites (relations schema.prisma)', async () => {
    const world = baseWorld();
    world.fks.push(
      { table: 'match_buts', column: 'buteur_id', refTable: 'insc_joueurs_dossier', refColumn: 'id' },
      { table: 'match_penalites', column: 'joueur_id', refTable: 'insc_joueurs_dossier', refColumn: 'id' },
    );

    const report = await verifySchema(fakePrisma(world));

    expect(report.ok).toBe(true);
    const warns = report.checks.filter((c) => c.warn);
    expect(warns.map((w) => w.label)).toEqual([
      'match_buts : FK supplémentaires hors migration.sql',
      'match_penalites : FK supplémentaires hors migration.sql',
    ]);
    expect(warns[0].detail).toContain('buteur_id → insc_joueurs_dossier.id');
  });

  it('KO (CA2) quand ta_equipes.EQUIPE_REF_ID porte une FK en base', async () => {
    const world = baseWorld();
    world.fks.push({ table: 'ta_equipes', column: 'EQUIPE_REF_ID', refTable: 'insc_equipes_referentiel', refColumn: 'id' });

    const report = await verifySchema(fakePrisma(world));

    expect(report.ok).toBe(false);
    const ko = report.checks.find((c) => !c.ok)!;
    expect(ko.label).toBe('ta_equipes.EQUIPE_REF_ID : aucune FK en base (CA2)');
    expect(ko.detail).toContain('insc_equipes_referentiel.id');
  });

  it("ignore une FK d'une AUTRE colonne de ta_equipes pour CA2", async () => {
    const world = baseWorld();
    world.fks.push({ table: 'ta_equipes', column: 'ID', refTable: 'autre', refColumn: 'id' });

    expect((await verifySchema(fakePrisma(world))).ok).toBe(true);
  });

  it("KO et conseil de rejeu quand ta_equipes a perdu EQUIPE_REF_ID (rechargement par l'import)", async () => {
    const world = baseWorld();
    world.tables.set('ta_equipes', [{ name: 'ID', type: 'int', nullable: false }]);

    const report = await verifySchema(fakePrisma(world));

    expect(report.ok).toBe(false);
    const ko = report.checks.find((c) => c.label.startsWith('ta_equipes.EQUIPE_REF_ID : int'))!;
    expect(ko.ok).toBe(false);
    expect(ko.detail).toMatch(/rejouer apply-migration/);
  });

  it('KO quand EQUIPE_REF_ID est NOT NULL', async () => {
    const world = baseWorld();
    world.tables.get('ta_equipes')!.find((c) => c.name === 'EQUIPE_REF_ID')!.nullable = false;

    expect((await verifySchema(fakePrisma(world))).ok).toBe(false);
  });

  it('KO quand une ligne de seed manque ou a une mauvaise durée', async () => {
    const world = baseWorld();
    world.seed = [
      { code: 'mineure', duree: 3 },
      { code: 'majeure', duree: 5 },
    ];

    const report = await verifySchema(fakePrisma(world));

    expect(failing(report.checks)).toEqual(
      expect.arrayContaining(['match_types_penalite : mineure (2 min)', 'match_types_penalite : meconduite (10 min)']),
    );
    expect(failing(report.checks)).not.toContain('match_types_penalite : majeure (5 min)');
  });

  it('est en lecture seule : n\'émet que des SELECT', async () => {
    const seen: string[] = [];
    const prisma = {
      $queryRawUnsafe: async (sql: string, ...params: unknown[]) => {
        seen.push(sql);
        return (fakePrisma(baseWorld()) as unknown as { $queryRawUnsafe: (s: string, ...p: unknown[]) => Promise<unknown> }).$queryRawUnsafe(sql, ...params);
      },
      $executeRawUnsafe: jest.fn(),
    } as unknown as PrismaClient;

    await verifySchema(prisma);

    expect(seen.length).toBeGreaterThan(0);
    for (const sql of seen) expect(sql.trim()).toMatch(/^SELECT/i);
    expect((prisma as unknown as { $executeRawUnsafe: jest.Mock }).$executeRawUnsafe).not.toHaveBeenCalled();
  });
});

// ── Inventaire des migrations (CA10) ────────────────────────────────────────

const MIGRATIONS = path.resolve(__dirname, '../../prisma/migrations');

/** Monde où TOUT ce que créent les migrations versionnées existe (colonnes MODIFY nullable comme attendu). */
function fullWorld(): World {
  const world = baseWorld();
  for (const dir of fs.readdirSync(MIGRATIONS, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const file = path.join(MIGRATIONS, dir.name, 'migration.sql');
    if (!fs.existsSync(file)) continue;
    const ids = extractIdentifiers(fs.readFileSync(file, 'utf8'));
    for (const t of ids.tables) if (!world.tables.has(t)) world.tables.set(t, []);
    for (const [t, cols] of Object.entries(ids.columns)) {
      const existing = world.tables.get(t) ?? [];
      for (const c of cols) if (!existing.some((e) => e.name === c)) existing.push({ name: c, type: 'int', nullable: true });
      world.tables.set(t, existing);
    }
    for (const m of ids.modified) {
      const existing = world.tables.get(m.table) ?? [];
      const col = existing.find((e) => e.name === m.column);
      if (col) col.nullable = m.nullable;
      else existing.push({ name: m.column, type: 'datetime', nullable: m.nullable });
      world.tables.set(m.table, existing);
    }
  }
  return world;
}

describe('inventoryMigrations', () => {
  const byName = (inv: Awaited<ReturnType<typeof inventoryMigrations>>, name: string) =>
    inv.find((i) => i.migration === name)!;

  it('liste toutes les migrations versionnées, triées', async () => {
    const inv = await inventoryMigrations(fakePrisma(fullWorld()));
    const names = inv.map((i) => i.migration);

    expect(names).toEqual([...names].sort());
    expect(names).toContain('20260904000001_table_de_marque_match_live');
    expect(names).toContain('20260919000000_edition_date_fin_fin_nullable');
  });

  it('« présente » pour toutes les migrations vérifiables quand rien ne manque', async () => {
    const inv = await inventoryMigrations(fakePrisma(fullWorld()));

    for (const item of inv) {
      expect(['présente', 'non vérifiable']).toContain(item.status);
      expect(item.missing).toEqual([]);
    }
  });

  it('« absente » pour la migration MODIFY quand la colonne est encore NOT NULL', async () => {
    const world = fullWorld();
    world.tables.get('insc_editions')!.find((c) => c.name === 'date_fin_fin')!.nullable = false;

    const item = byName(await inventoryMigrations(fakePrisma(world)), '20260919000000_edition_date_fin_fin_nullable');

    expect(item.status).toBe('absente');
    expect(item.missing).toEqual(['colonne insc_editions.date_fin_fin (nullable=true attendu)']);
  });

  it('« absente » quand toutes les tables/colonnes de la migration table de marque manquent', async () => {
    const world = fullWorld();
    for (const t of Object.keys(EXPECTED_SCHEMA.tables)) world.tables.delete(t);
    world.tables.set('ta_equipes', [{ name: 'ID', type: 'int', nullable: false }]);

    const item = byName(await inventoryMigrations(fakePrisma(world)), '20260904000001_table_de_marque_match_live');

    expect(item.status).toBe('absente');
    expect(item.missing).toEqual(expect.arrayContaining(['table match_live', 'colonne ta_equipes.EQUIPE_REF_ID']));
  });

  it('« partielle » quand seule une partie des objets existe', async () => {
    const world = fullWorld();
    world.tables.delete('match_live');
    world.tables.get('ta_equipes')!.pop();

    const item = byName(await inventoryMigrations(fakePrisma(world)), '20260904000001_table_de_marque_match_live');

    expect(item.status).toBe('partielle');
    expect(item.missing).toContain('table match_live');
  });

  it('« non vérifiable » pour une migration sans création ni ajout de colonne', async () => {
    const inv = await inventoryMigrations(fakePrisma(fullWorld()));

    expect(inv.some((i) => i.status === 'non vérifiable')).toBe(true);
  });
});

describe('affichage', () => {
  it('printChecks / printInventory écrivent OK, KO, WARN et le détail des manques', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    printChecks([
      { label: 'a', ok: true },
      { label: 'b', ok: false, detail: 'pourquoi' },
      { label: 'c', ok: true, warn: true, detail: 'attention' },
    ]);
    printInventory([{ migration: 'm1', status: 'partielle', missing: ['table x'] }]);

    const out = log.mock.calls.map((c) => c[0]).join('\n');
    expect(out).toContain('[OK] a');
    expect(out).toContain('[KO] b — pourquoi');
    expect(out).toContain('[WARN] c — attention');
    expect(out).toContain('partielle');
    expect(out).toContain('manque : table x');
    log.mockRestore();
  });
});
