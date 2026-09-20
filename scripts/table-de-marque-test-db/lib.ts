// Fonctions pures (sans I/O) des scripts de rattrapage de schéma sur la base de TEST.
// Voir docs/specs/dcision-pas-acceptable-on-laisse-en-ltat-car-risque-limit-pa.track.md
// et docs/adr/ADR-002-garde-fou-base-test-scripts-sql.md.

// ── Cible et garde-fou ──────────────────────────────────────────────────────

/** Jamais d'utilisateur ni de mot de passe : cet objet peut être affiché/journalisé. */
export interface DatabaseTarget {
  host: string;
  port: number;
  database: string;
}

export function parseDatabaseTarget(databaseUrl: string): DatabaseTarget {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL invalide (format attendu : mysql://user:pass@host:port/base).');
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!database) {
    throw new Error('DATABASE_URL ne désigne aucune base (chemin vide).');
  }
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    database,
  };
}

export interface SafetyInputs {
  /** Nom de base lu dans DATABASE_URL. */
  urlDatabase: string;
  /** DB_NAME s'il est défini dans l'environnement. */
  envDbName: string | null;
  /** Résultat de SELECT DATABASE() ; null tant que la connexion n'est pas ouverte. */
  serverDatabase: string | null;
  /** Valeur de --target=. */
  cliTarget: string | null;
}

export const TEST_DATABASE_SUFFIX = '_test';

/**
 * Refuse toute cible qui n'est pas une base de test, sans aucune option de
 * contournement. Appelée deux fois : avant connexion (serverDatabase = null),
 * puis après (SELECT DATABASE()).
 */
export function assertSafeTestTarget(input: SafetyInputs): void {
  const { urlDatabase, envDbName, serverDatabase, cliTarget } = input;

  if (!urlDatabase.endsWith(TEST_DATABASE_SUFFIX)) {
    throw new Error(
      `Refus : la base ciblée par DATABASE_URL est « ${urlDatabase} » ; seules les bases se terminant par « ${TEST_DATABASE_SUFFIX} » sont autorisées.`,
    );
  }
  if (envDbName !== null && envDbName !== urlDatabase) {
    throw new Error(
      `Refus : DB_NAME (« ${envDbName} ») diffère de la base de DATABASE_URL (« ${urlDatabase} »).`,
    );
  }
  if (cliTarget === null || cliTarget === '') {
    throw new Error(
      `Refus : --target=<base> est obligatoire (attendu : --target=${urlDatabase}).`,
    );
  }
  if (cliTarget !== urlDatabase) {
    throw new Error(
      `Refus : --target (« ${cliTarget} ») diffère de la base de DATABASE_URL (« ${urlDatabase} »).`,
    );
  }
  if (serverDatabase !== null && serverDatabase !== urlDatabase) {
    throw new Error(
      `Refus : le serveur indique être connecté à « ${serverDatabase} », pas à « ${urlDatabase} ».`,
    );
  }
}

export interface CliArgs {
  target: string | null;
  dryRun: boolean;
  compatMysql8: boolean;
}

export function parseCliArgs(argv: string[]): CliArgs {
  const args: CliArgs = { target: null, dryRun: false, compatMysql8: false };
  for (const arg of argv) {
    if (arg.startsWith('--target=')) args.target = arg.slice('--target='.length);
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--compat-mysql8') args.compatMysql8 = true;
    else throw new Error(`Argument inconnu : ${arg}`);
  }
  return args;
}

// ── Analyse du SQL de migration ─────────────────────────────────────────────

/** Retire les commentaires `--` (hors chaînes) et découpe sur `;` (hors chaînes). */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let quote: "'" | '"' | '`' | null = null;

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];

    if (quote) {
      current += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      current += c;
      continue;
    }
    if (c === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      current += '\n';
      continue;
    }
    if (c === ';') {
      if (current.trim()) statements.push(current.trim());
      current = '';
      continue;
    }
    current += c;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

const ADDITIVE_PATTERNS: RegExp[] = [
  /^ALTER\s+TABLE\s+`?ta_equipes`?\s+ADD\s+COLUMN\b/i,
  /^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+`match_(types_penalite|live|buts|penalites)`/i,
  /^INSERT\s+INTO\s+`match_types_penalite`/i,
];

/**
 * Défense en profondeur : le script n'exécute que des instructions strictement
 * additives sur les objets de la brique table de marque (jamais DROP/DELETE/
 * UPDATE/TRUNCATE ni aucune autre table).
 */
export function assertAdditiveStatements(statements: string[]): void {
  statements.forEach((statement, index) => {
    if (!ADDITIVE_PATTERNS.some((pattern) => pattern.test(statement))) {
      throw new Error(
        `Instruction n°${index + 1} hors périmètre additif, refusée : ${statement.slice(0, 80).replace(/\s+/g, ' ')}…`,
      );
    }
  });
}

export interface ModifiedColumn {
  table: string;
  column: string;
  nullable: boolean;
}

export interface SqlIdentifiers {
  tables: string[];
  /** Colonnes créées (CREATE TABLE) ou ajoutées (ADD COLUMN), par table. */
  columns: Record<string, string[]>;
  /** Colonnes modifiées (MODIFY) : vérifiables sur la nullabilité uniquement. */
  modified: ModifiedColumn[];
}

/** Extrait les tables/colonnes créées ou modifiées par un fichier de migration. */
export function extractIdentifiers(sql: string): SqlIdentifiers {
  const result: SqlIdentifiers = { tables: [], columns: {}, modified: [] };
  const addColumn = (table: string, column: string) => {
    (result.columns[table] ??= []);
    if (!result.columns[table].includes(column)) result.columns[table].push(column);
  };

  for (const statement of splitSqlStatements(sql)) {
    const create = statement.match(
      /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`([^`]+)`\s*\(([\s\S]*)\)[^)]*$/i,
    );
    if (create) {
      const [, table, body] = create;
      if (!result.tables.includes(table)) result.tables.push(table);
      result.columns[table] ??= [];
      for (const line of body.split('\n')) {
        const col = line.trim().match(/^`([^`]+)`\s+\S/);
        if (col) addColumn(table, col[1]);
      }
      continue;
    }

    const alter = statement.match(/^ALTER\s+TABLE\s+`([^`]+)`\s+([\s\S]*)$/i);
    if (alter) {
      const [, table, rest] = alter;
      for (const add of rest.matchAll(/ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?`([^`]+)`/gi)) {
        addColumn(table, add[1]);
      }
      for (const mod of rest.matchAll(/MODIFY\s+(?:COLUMN\s+)?`([^`]+)`([^,;]*)/gi)) {
        result.modified.push({
          table,
          column: mod[1],
          nullable: !/NOT\s+NULL/i.test(mod[2]),
        });
      }
    }
  }
  return result;
}

// ── Schéma attendu (miroir de 20260904000001_table_de_marque_match_live) ────

export interface ExpectedColumn {
  name: string;
  /** information_schema.columns.DATA_TYPE, en minuscules. */
  type: string;
  nullable: boolean;
}

export interface ExpectedTable {
  columns: ExpectedColumn[];
  primaryKey: string[];
  foreignKeys: { column: string; refTable: string; refColumn: string }[];
}

export const EXPECTED_SCHEMA: {
  tables: Record<
    'match_live' | 'match_buts' | 'match_penalites' | 'match_types_penalite',
    ExpectedTable
  >;
  taEquipesColumn: { name: 'EQUIPE_REF_ID'; type: 'int'; nullable: true; hasForeignKey: false };
  seed: { code: string; dureeMinutesDefaut: number }[];
} = {
  tables: {
    match_types_penalite: {
      columns: [
        { name: 'code', type: 'varchar', nullable: false },
        { name: 'libelle', type: 'varchar', nullable: false },
        { name: 'duree_minutes_defaut', type: 'int', nullable: false },
        { name: 'actif', type: 'tinyint', nullable: false },
      ],
      primaryKey: ['code'],
      foreignKeys: [],
    },
    match_live: {
      columns: [
        { name: 'num_match', type: 'int', nullable: false },
        { name: 'etat', type: 'enum', nullable: false },
        { name: 'temps_ecoule_secondes', type: 'int', nullable: false },
        { name: 'chrono_en_cours', type: 'tinyint', nullable: false },
        { name: 'chrono_derniere_maj_at', type: 'datetime', nullable: true },
        { name: 'score1_cache', type: 'int', nullable: false },
        { name: 'score2_cache', type: 'int', nullable: false },
        { name: 'created_at', type: 'datetime', nullable: false },
        { name: 'updated_at', type: 'datetime', nullable: false },
      ],
      primaryKey: ['num_match'],
      foreignKeys: [],
    },
    match_buts: {
      columns: [
        { name: 'id', type: 'int', nullable: false },
        { name: 'num_match', type: 'int', nullable: false },
        { name: 'equipe_id', type: 'int', nullable: false },
        { name: 'buteur_id', type: 'int', nullable: false },
        { name: 'assist1_id', type: 'int', nullable: true },
        { name: 'assist2_id', type: 'int', nullable: true },
        { name: 'temps_jeu_secondes', type: 'int', nullable: false },
        { name: 'created_at', type: 'datetime', nullable: false },
      ],
      primaryKey: ['id'],
      foreignKeys: [{ column: 'num_match', refTable: 'match_live', refColumn: 'num_match' }],
    },
    match_penalites: {
      columns: [
        { name: 'id', type: 'int', nullable: false },
        { name: 'num_match', type: 'int', nullable: false },
        { name: 'equipe_id', type: 'int', nullable: false },
        { name: 'joueur_id', type: 'int', nullable: false },
        { name: 'type_penalite_code', type: 'varchar', nullable: false },
        { name: 'duree_minutes', type: 'int', nullable: false },
        { name: 'temps_jeu_debut', type: 'int', nullable: false },
        { name: 'created_at', type: 'datetime', nullable: false },
      ],
      primaryKey: ['id'],
      foreignKeys: [
        { column: 'num_match', refTable: 'match_live', refColumn: 'num_match' },
        { column: 'type_penalite_code', refTable: 'match_types_penalite', refColumn: 'code' },
      ],
    },
  },
  taEquipesColumn: { name: 'EQUIPE_REF_ID', type: 'int', nullable: true, hasForeignKey: false },
  seed: [
    { code: 'mineure', dureeMinutesDefaut: 2 },
    { code: 'majeure', dureeMinutesDefaut: 5 },
    { code: 'meconduite', dureeMinutesDefaut: 10 },
  ],
};

// ── Comparaison des volumétries avant / après ───────────────────────────────

export type TableCounts = Record<string, number>;

export interface CountExpectation {
  /** Tables qui n'existaient pas avant et doivent exister après. */
  nouvellesTables: string[];
  /** Lignes ajoutables au maximum par table (seed). */
  lignesSeed: Record<string, number>;
}

export function diffCounts(
  avant: TableCounts,
  apres: TableCounts,
  attendu: CountExpectation,
): { ok: boolean; anomalies: string[] } {
  const anomalies: string[] = [];

  for (const [table, before] of Object.entries(avant)) {
    const after = apres[table];
    if (after === undefined) {
      anomalies.push(`Table existante disparue : ${table}`);
      continue;
    }
    const maxAjout = attendu.lignesSeed[table] ?? 0;
    if (after < before || after > before + maxAjout) {
      anomalies.push(
        `Volumétrie modifiée sur ${table} : ${before} → ${after} (ajout admis : 0..${maxAjout})`,
      );
    }
  }

  for (const table of attendu.nouvellesTables) {
    const after = apres[table];
    if (after === undefined) {
      anomalies.push(`Nouvelle table absente après application : ${table}`);
      continue;
    }
    const maxAjout = attendu.lignesSeed[table] ?? 0;
    if (after > maxAjout) {
      anomalies.push(`Nouvelle table ${table} contient ${after} ligne(s) (max ${maxAjout})`);
    }
  }

  for (const table of Object.keys(apres)) {
    if (!(table in avant) && !attendu.nouvellesTables.includes(table)) {
      anomalies.push(`Table inattendue apparue : ${table}`);
    }
  }

  return { ok: anomalies.length === 0, anomalies };
}
