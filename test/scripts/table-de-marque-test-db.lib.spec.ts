import * as fs from 'fs';
import * as path from 'path';
import {
  EXPECTED_SCHEMA,
  assertAdditiveStatements,
  assertSafeTestTarget,
  diffCounts,
  extractIdentifiers,
  parseCliArgs,
  parseDatabaseTarget,
  splitSqlStatements,
  type SafetyInputs,
} from '../../scripts/table-de-marque-test-db/lib';

const MIGRATIONS = path.resolve(__dirname, '../../prisma/migrations');
const readMigration = (name: string) =>
  fs.readFileSync(path.join(MIGRATIONS, name, 'migration.sql'), 'utf8');
const TDM_SQL = readMigration('20260904000001_table_de_marque_match_live');

describe('parseDatabaseTarget', () => {
  it('extrait hôte, port et base', () => {
    expect(
      parseDatabaseTarget('mysql://user:pw@mysql-rchcu11.alwaysdata.net:3307/rchcu11_tournoi_test'),
    ).toEqual({
      host: 'mysql-rchcu11.alwaysdata.net',
      port: 3307,
      database: 'rchcu11_tournoi_test',
    });
  });

  it('utilise le port 3306 par défaut', () => {
    expect(parseDatabaseTarget('mysql://u:p@localhost/ma_base_test').port).toBe(3306);
  });

  it('décode un mot de passe encodé sans planter', () => {
    expect(parseDatabaseTarget('mysql://u:p%40ss%2Fw0rd@localhost:3306/x_test').database).toBe('x_test');
  });

  it('ignore les paramètres de requête dans le nom de base', () => {
    expect(parseDatabaseTarget('mysql://u:p@h:3306/x_test?connection_limit=5').database).toBe('x_test');
  });

  it('ne renvoie jamais utilisateur ni mot de passe (objet affichable/journalisable)', () => {
    const target = parseDatabaseTarget('mysql://SECRETUSER:SECRETPASS@h:3306/x_test');
    expect(Object.keys(target).sort()).toEqual(['database', 'host', 'port']);
    expect(JSON.stringify(target)).not.toMatch(/SECRET/);
  });

  it.each(['pas une url', '', 'mysql://u:p@h:3306', 'mysql://u:p@h:3306/'])(
    'rejette %p (URL invalide ou sans base)',
    (url) => {
      expect(() => parseDatabaseTarget(url)).toThrow();
    },
  );

  it("n'inclut pas l'URL ni le mot de passe dans le message d'erreur", () => {
    try {
      parseDatabaseTarget('mysql://u:TOPSECRET@h:3306/');
      throw new Error('aurait dû lever');
    } catch (e) {
      expect((e as Error).message).not.toMatch(/TOPSECRET/);
    }
  });
});

describe('assertSafeTestTarget', () => {
  const ok: SafetyInputs = {
    urlDatabase: 'rchcu11_tournoi_test',
    envDbName: 'rchcu11_tournoi_test',
    serverDatabase: 'rchcu11_tournoi_test',
    cliTarget: 'rchcu11_tournoi_test',
  };

  it('accepte une base _test cohérente partout', () => {
    expect(() => assertSafeTestTarget(ok)).not.toThrow();
  });

  it('accepte avant connexion (serverDatabase = null) et DB_NAME absent', () => {
    expect(() => assertSafeTestTarget({ ...ok, serverDatabase: null, envDbName: null })).not.toThrow();
  });

  it('refuse la base de PRODUCTION même avec --target identique', () => {
    expect(() =>
      assertSafeTestTarget({
        urlDatabase: 'rchcu11_tournoi',
        envDbName: 'rchcu11_tournoi',
        serverDatabase: 'rchcu11_tournoi',
        cliTarget: 'rchcu11_tournoi',
      }),
    ).toThrow(/_test/);
  });

  it.each(['rchcu11_tournoi_test_old', 'test', 'rchcu11_tournoi_TEST', 'rchcu11_tournoi_test '])(
    'refuse un nom qui ne se termine pas exactement par _test (%p)',
    (name) => {
      expect(() =>
        assertSafeTestTarget({ ...ok, urlDatabase: name, envDbName: null, serverDatabase: null, cliTarget: name }),
      ).toThrow();
    },
  );

  it('refuse sans --target (null ou vide)', () => {
    expect(() => assertSafeTestTarget({ ...ok, cliTarget: null })).toThrow(/--target/);
    expect(() => assertSafeTestTarget({ ...ok, cliTarget: '' })).toThrow(/--target/);
  });

  it('refuse un --target différent de la base de DATABASE_URL', () => {
    expect(() => assertSafeTestTarget({ ...ok, cliTarget: 'rchcu11_tournoi' })).toThrow(/diffère/);
    expect(() => assertSafeTestTarget({ ...ok, cliTarget: 'autre_test' })).toThrow(/diffère/);
  });

  it('refuse un DB_NAME défini et différent (même si les deux sont _test)', () => {
    expect(() => assertSafeTestTarget({ ...ok, envDbName: 'autre_test' })).toThrow(/DB_NAME/);
    expect(() => assertSafeTestTarget({ ...ok, envDbName: 'rchcu11_tournoi' })).toThrow(/DB_NAME/);
  });

  it('refuse quand le serveur indique une autre base que celle de DATABASE_URL', () => {
    expect(() => assertSafeTestTarget({ ...ok, serverDatabase: 'rchcu11_tournoi' })).toThrow(/serveur/);
    expect(() => assertSafeTestTarget({ ...ok, serverDatabase: '(aucune)' })).toThrow(/serveur/);
  });

  it("n'offre aucune option de contournement (un seul paramètre, aucun champ force/override)", () => {
    expect(assertSafeTestTarget.length).toBe(1);
    expect(() =>
      assertSafeTestTarget({
        ...ok,
        urlDatabase: 'rchcu11_tournoi',
        envDbName: null,
        serverDatabase: null,
        cliTarget: 'rchcu11_tournoi',
        force: true,
      } as SafetyInputs),
    ).toThrow();
  });
});

describe('parseCliArgs', () => {
  it('lit --target, --dry-run et --compat-mysql8', () => {
    expect(parseCliArgs(['--target=x_test', '--dry-run', '--compat-mysql8'])).toEqual({
      target: 'x_test',
      dryRun: true,
      compatMysql8: true,
    });
  });

  it('valeurs par défaut : aucune cible, aucune option', () => {
    expect(parseCliArgs([])).toEqual({ target: null, dryRun: false, compatMysql8: false });
  });

  it('refuse un argument inconnu, y compris un éventuel --force', () => {
    expect(() => parseCliArgs(['--force'])).toThrow(/inconnu/);
    expect(() => parseCliArgs(['--allow-prod'])).toThrow(/inconnu/);
  });
});

describe('splitSqlStatements', () => {
  it('découpe le vrai migration.sql en exactement 6 instructions, dans l\'ordre', () => {
    const statements = splitSqlStatements(TDM_SQL);
    expect(statements).toHaveLength(6);
    expect(statements[0]).toMatch(/^ALTER TABLE `ta_equipes`\s+ADD COLUMN IF NOT EXISTS `EQUIPE_REF_ID`/);
    expect(statements[1]).toMatch(/^CREATE TABLE IF NOT EXISTS `match_types_penalite`/);
    expect(statements[2]).toMatch(/^INSERT INTO `match_types_penalite`/);
    expect(statements[3]).toMatch(/^CREATE TABLE IF NOT EXISTS `match_live`/);
    expect(statements[4]).toMatch(/^CREATE TABLE IF NOT EXISTS `match_buts`/);
    expect(statements[5]).toMatch(/^CREATE TABLE IF NOT EXISTS `match_penalites`/);
  });

  it('ne conserve aucun commentaire `--` ni point-virgule final', () => {
    for (const statement of splitSqlStatements(TDM_SQL)) {
      expect(statement).not.toMatch(/^--|\n\s*--/);
      expect(statement.endsWith(';')).toBe(false);
    }
  });

  it('ne scinde pas ON DUPLICATE KEY UPDATE de son INSERT', () => {
    const insert = splitSqlStatements(TDM_SQL)[2];
    expect(insert).toMatch(/ON DUPLICATE KEY UPDATE/);
    expect(insert).toMatch(/'meconduite'/);
  });

  it('ignore un point-virgule ou un `--` situés dans une chaîne', () => {
    const statements = splitSqlStatements("INSERT INTO `t` VALUES ('a;b -- c'); SELECT 1;");
    expect(statements).toEqual(["INSERT INTO `t` VALUES ('a;b -- c')", 'SELECT 1']);
  });

  it('gère un commentaire en fin de ligne et les instructions vides', () => {
    expect(splitSqlStatements('SELECT 1; -- fin\n;;\nSELECT 2 -- x')).toEqual(['SELECT 1', 'SELECT 2']);
  });

  it('retourne un tableau vide pour un fichier vide ou uniquement des commentaires', () => {
    expect(splitSqlStatements('')).toEqual([]);
    expect(splitSqlStatements('-- rien\n-- du tout\n')).toEqual([]);
  });
});

describe('assertAdditiveStatements (liste blanche)', () => {
  it('accepte les 6 instructions du vrai migration.sql', () => {
    expect(() => assertAdditiveStatements(splitSqlStatements(TDM_SQL))).not.toThrow();
  });

  it.each([
    'DROP TABLE `match_live`',
    'DROP TABLE IF EXISTS `match_buts`',
    'DELETE FROM `match_types_penalite`',
    'UPDATE `match_types_penalite` SET `actif` = 0',
    'TRUNCATE TABLE `match_live`',
    'ALTER TABLE `ta_equipes` DROP COLUMN `EQUIPE_REF_ID`',
    'ALTER TABLE `ta_matchs` ADD COLUMN `x` INT NULL',
    'ALTER TABLE `insc_editions` MODIFY `date_fin_fin` DATETIME NULL',
    'CREATE TABLE IF NOT EXISTS `autre_table` (`id` INT)',
    'INSERT INTO `ta_equipes` (`ID`) VALUES (1)',
  ])('refuse %p', (statement) => {
    expect(() => assertAdditiveStatements([statement])).toThrow(/hors périmètre additif/);
  });

  it("signale le numéro de l'instruction fautive", () => {
    expect(() =>
      assertAdditiveStatements([
        'CREATE TABLE IF NOT EXISTS `match_live` (`num_match` INT)',
        'DROP TABLE `match_live`',
      ]),
    ).toThrow(/n°2/);
  });
});

describe('extractIdentifiers', () => {
  const ids = extractIdentifiers(TDM_SQL);

  it('trouve les 4 tables créées', () => {
    expect([...ids.tables].sort()).toEqual(
      ['match_buts', 'match_live', 'match_penalites', 'match_types_penalite'].sort(),
    );
  });

  it('trouve la colonne ajoutée à ta_equipes', () => {
    expect(ids.columns.ta_equipes).toEqual(['EQUIPE_REF_ID']);
  });

  it('ne prend ni les CONSTRAINT ni les PRIMARY KEY pour des colonnes', () => {
    for (const columns of Object.values(ids.columns)) {
      for (const c of columns) expect(c).not.toMatch(/fkey|PRIMARY/i);
    }
  });

  it('détecte une colonne MODIFY nullable (migration du switch inscriptions)', () => {
    expect(extractIdentifiers(readMigration('20260919000000_edition_date_fin_fin_nullable')).modified).toEqual([
      { table: 'insc_editions', column: 'date_fin_fin', nullable: true },
    ]);
  });

  it('détecte un MODIFY ... NOT NULL', () => {
    const { modified } = extractIdentifiers('ALTER TABLE `t` MODIFY `c` INT NOT NULL;');
    expect(modified).toEqual([{ table: 't', column: 'c', nullable: false }]);
  });

  it('extrait plusieurs ADD COLUMN d\'un même ALTER', () => {
    const { columns } = extractIdentifiers(
      'ALTER TABLE `t` ADD COLUMN `a` INT NULL, ADD COLUMN IF NOT EXISTS `b` INT NULL;',
    );
    expect(columns.t).toEqual(['a', 'b']);
  });

  it('ne retourne rien pour un SQL sans création ni modification', () => {
    expect(extractIdentifiers('INSERT INTO `t` VALUES (1);')).toEqual({ tables: [], columns: {}, modified: [] });
  });

  it('fonctionne sur toutes les migrations versionnées sans lever', () => {
    for (const dir of fs.readdirSync(MIGRATIONS, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const file = path.join(MIGRATIONS, dir.name, 'migration.sql');
      if (fs.existsSync(file)) expect(() => extractIdentifiers(fs.readFileSync(file, 'utf8'))).not.toThrow();
    }
  });
});

describe('EXPECTED_SCHEMA — dérive par rapport à migration.sql', () => {
  const ids = extractIdentifiers(TDM_SQL);

  it('déclare exactement les tables créées par migration.sql', () => {
    expect(Object.keys(EXPECTED_SCHEMA.tables).sort()).toEqual([...ids.tables].sort());
  });

  it.each(Object.keys(EXPECTED_SCHEMA.tables))(
    'déclare exactement les colonnes de %s (aucune manquante, aucune en trop)',
    (table) => {
      const expected = EXPECTED_SCHEMA.tables[table as keyof typeof EXPECTED_SCHEMA.tables].columns.map((c) => c.name);
      expect([...expected].sort()).toEqual([...ids.columns[table]].sort());
    },
  );

  it('déclare la colonne ta_equipes.EQUIPE_REF_ID de migration.sql, nullable et sans FK', () => {
    expect(ids.columns.ta_equipes).toEqual([EXPECTED_SCHEMA.taEquipesColumn.name]);
    expect(EXPECTED_SCHEMA.taEquipesColumn).toMatchObject({ nullable: true, hasForeignKey: false });
  });

  it('reflète la nullabilité de migration.sql (colonnes NULL vs NOT NULL)', () => {
    for (const [table, def] of Object.entries(EXPECTED_SCHEMA.tables)) {
      const block = TDM_SQL.match(new RegExp(`CREATE TABLE IF NOT EXISTS \`${table}\` \\(([\\s\\S]*?)\\) DEFAULT`))![1];
      for (const col of def.columns) {
        const line = block.split('\n').find((l) => l.trim().startsWith(`\`${col.name}\``))!;
        expect(/\bNOT NULL\b/.test(line)).toBe(!col.nullable);
      }
    }
  });

  it('reflète les clés primaires et FK de migration.sql', () => {
    expect(TDM_SQL).toMatch(/PRIMARY KEY \(`num_match`\)/);
    expect(EXPECTED_SCHEMA.tables.match_live.primaryKey).toEqual(['num_match']);
    expect(EXPECTED_SCHEMA.tables.match_buts.foreignKeys).toEqual([
      { column: 'num_match', refTable: 'match_live', refColumn: 'num_match' },
    ]);
    expect(EXPECTED_SCHEMA.tables.match_penalites.foreignKeys).toEqual([
      { column: 'num_match', refTable: 'match_live', refColumn: 'num_match' },
      { column: 'type_penalite_code', refTable: 'match_types_penalite', refColumn: 'code' },
    ]);
    expect(TDM_SQL).toMatch(/match_penalites_type_penalite_code_fkey/);
  });

  it('reflète le seed de migration.sql (codes et durées)', () => {
    const seedRows = [...TDM_SQL.matchAll(/\('(\w+)',\s*'[^']*',\s*(\d+),\s*1\)/g)].map((m) => ({
      code: m[1],
      dureeMinutesDefaut: Number(m[2]),
    }));
    expect(EXPECTED_SCHEMA.seed).toEqual(seedRows);
    expect(EXPECTED_SCHEMA.seed).toHaveLength(3);
  });
});

describe('diffCounts', () => {
  const avant = { TA_MATCHS: 40, ta_equipes: 12, insc_editions: 3 };
  const attendu = {
    nouvellesTables: ['match_live', 'match_types_penalite'],
    lignesSeed: { match_types_penalite: 3 },
  };

  it('nominal : tables existantes inchangées, nouvelles tables vides + seed', () => {
    const apres = { ...avant, match_live: 0, match_types_penalite: 3 };
    expect(diffCounts(avant, apres, attendu)).toEqual({ ok: true, anomalies: [] });
  });

  it('accepte un seed partiel (0 à 3 lignes) et le rejeu sans changement', () => {
    expect(diffCounts(avant, { ...avant, match_live: 0, match_types_penalite: 1 }, attendu).ok).toBe(true);
    const rejeu = { ...avant, match_live: 0, match_types_penalite: 3 };
    expect(diffCounts(rejeu, rejeu, { nouvellesTables: [], lignesSeed: { match_types_penalite: 0 } }).ok).toBe(true);
  });

  it('anomalie : une ligne ajoutée dans une table existante non seedée', () => {
    const r = diffCounts(avant, { ...avant, ta_equipes: 13, match_live: 0, match_types_penalite: 3 }, attendu);
    expect(r.ok).toBe(false);
    expect(r.anomalies.join('\n')).toMatch(/ta_equipes.*12 → 13/);
  });

  it('anomalie : une ligne supprimée dans une table existante', () => {
    const r = diffCounts(avant, { ...avant, TA_MATCHS: 39, match_live: 0, match_types_penalite: 3 }, attendu);
    expect(r.ok).toBe(false);
    expect(r.anomalies.join('\n')).toMatch(/TA_MATCHS.*40 → 39/);
  });

  it('anomalie : une table existante a disparu', () => {
    const { insc_editions: _perdue, ...sansTable } = avant;
    const r = diffCounts(avant, { ...sansTable, match_live: 0, match_types_penalite: 3 }, attendu);
    expect(r.ok).toBe(false);
    expect(r.anomalies.join('\n')).toMatch(/disparue : insc_editions/);
  });

  it('anomalie : une nouvelle table attendue est absente après application', () => {
    const r = diffCounts(avant, { ...avant, match_types_penalite: 3 }, attendu);
    expect(r.ok).toBe(false);
    expect(r.anomalies.join('\n')).toMatch(/absente après application : match_live/);
  });

  it('anomalie : une nouvelle table contient trop de lignes', () => {
    const r = diffCounts(avant, { ...avant, match_live: 2, match_types_penalite: 3 }, attendu);
    expect(r.ok).toBe(false);
    expect(r.anomalies.join('\n')).toMatch(/match_live contient 2/);
  });

  it('anomalie : une table inattendue apparaît', () => {
    const r = diffCounts(avant, { ...avant, match_live: 0, match_types_penalite: 3, intruse: 0 }, attendu);
    expect(r.ok).toBe(false);
    expect(r.anomalies.join('\n')).toMatch(/inattendue apparue : intruse/);
  });

  it('cumule plusieurs anomalies indépendantes', () => {
    const r = diffCounts(avant, { TA_MATCHS: 1, ta_equipes: 12, match_types_penalite: 3 }, attendu);
    expect(r.ok).toBe(false);
    expect(r.anomalies.length).toBeGreaterThanOrEqual(3);
  });
});
