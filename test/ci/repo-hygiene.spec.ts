import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Racine du dépôt Git de `back/` (rootDir Jest = back/, cf. package.json).
const REPO_ROOT = join(__dirname, '../..');

const GITIGNORE_PATH = join(REPO_ROOT, '.gitignore');
const DOCKERFILE_PATH = join(REPO_ROOT, 'Dockerfile');
const DOCKERIGNORE_PATH = join(REPO_ROOT, '.dockerignore');
const CACHE_SNAPSHOT_PATH = join(REPO_ROOT, 'cache', 'snapshots.json');
const ORPHAN_FILE_NAME = '0].{name';
const LEAKED_KEY_PATTERN = 'table-de-marque-back-cloudrun-ef714b0b885a.json';

function git(args: string[]) {
  return spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf-8' });
}

const isGitRepo = git(['rev-parse', '--is-inside-work-tree']).status === 0;
const describeIfGit = isGitRepo ? describe : describe.skip;

describe('Repo hygiene — back/.gitignore', () => {
  const raw = readFileSync(GITIGNORE_PATH);

  it("ne contient plus aucun octet nul (corruption UTF-16LE réparée)", () => {
    expect(raw.includes(0)).toBe(false);
  });

  it('ignore le dossier de cache runtime via un pattern ancré /cache/', () => {
    const text = raw.toString('utf-8');
    expect(text).toMatch(/^\/cache\/\r?\n/m);
  });

  it("place /cache/ dans le groupe 'compiled output', juste après /dist et avant /node_modules", () => {
    const text = raw.toString('utf-8');
    expect(text).toMatch(/\/dist\r?\n\/cache\/\r?\n\/node_modules\r?\n/);
  });

  it('contient la ligne réparée du pattern de clé GCP Cloud Run (en UTF-8 propre)', () => {
    const text = raw.toString('utf-8');
    expect(text).toMatch(new RegExp(`^${LEAKED_KEY_PATTERN.replace(/\./g, '\\.')}\\r?\\n?$`, 'm'));
  });

  it("n'a pas perdu d'autres règles existantes autour des lignes modifiées (diff ciblé)", () => {
    const text = raw.toString('utf-8');
    // Sentinelles de part et d'autre des deux zones touchées : si l'une de ces
    // règles préexistantes disparaissait, ce serait le signe d'une réécriture
    // trop large du fichier plutôt que d'une édition chirurgicale (critère
    // d'acceptation "diff minimal").
    for (const sentinel of [
      '/build',
      '.env',
      'service-account.json',
      '*-key.json',
      '*service-account*.json',
      'report.[0-9]*.[0-9]*.[0-9]*.[0-9]*.json',
      '/generated/prisma',
    ]) {
      expect(text).toContain(sentinel);
    }
  });
});

describeIfGit('Repo hygiene — état Git (cache tracké, fichier orphelin)', () => {
  it('git check-ignore matche cache/snapshots.json via /cache/', () => {
    const result = git(['check-ignore', '-v', 'cache/snapshots.json']);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/\.gitignore:\d+:\/cache\/\s+cache\/snapshots\.json/);
  });

  it("git check-ignore NE matche PAS le code source src/infrastructure/cache/ (pattern non trop large)", () => {
    const result = git([
      'check-ignore',
      '-v',
      'src/infrastructure/cache/cache.snapshot.service.ts',
    ]);
    // Code de sortie 1 = aucun pattern ne matche (comportement attendu ici).
    expect(result.status).toBe(1);
    expect(result.stdout.trim()).toBe('');
  });

  it('git check-ignore matche le nom de fichier de clé GCP Cloud Run réparé', () => {
    const result = git(['check-ignore', '-v', LEAKED_KEY_PATTERN]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(LEAKED_KEY_PATTERN);
  });

  it("cache/snapshots.json n'est plus suivi par Git (git ls-files) mais reste présent sur disque", () => {
    const result = git(['ls-files', '--', 'cache/snapshots.json']);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
    expect(existsSync(CACHE_SNAPSHOT_PATH)).toBe(true);
  });

  it("un changement de contenu de cache/snapshots.json n'apparaît plus dans git status (régénération runtime silencieuse)", () => {
    // Régénère le contenu comme le ferait CacheSnapshotService.flushPersist(),
    // sans dépendre d'une vraie connexion MySQL, puis vérifie que git status
    // reste muet sur ce fichier (critère d'acceptation 4).
    const before = existsSync(CACHE_SNAPSHOT_PATH)
      ? readFileSync(CACHE_SNAPSHOT_PATH)
      : null;
    try {
      const fs = require('node:fs') as typeof import('node:fs');
      fs.mkdirSync(join(REPO_ROOT, 'cache'), { recursive: true });
      fs.writeFileSync(
        CACHE_SNAPSHOT_PATH,
        JSON.stringify({ qaRegenerationProbe: true, ts: Date.now() }),
      );

      const status = git(['status', '--porcelain', '--', 'cache/snapshots.json']);
      expect(status.status).toBe(0);
      const line = status.stdout.trim();
      // Tant que le `git rm --cached` n'a pas été committé, git status peut
      // encore afficher la suppression indexée en attente ("D  ...") — c'est
      // un état de transition normal, pas une régression. Ce qui ne doit
      // JAMAIS réapparaître, c'est un statut de modification de contenu
      // ("M"/" M") causé par la régénération runtime du fichier.
      if (line !== '') {
        expect(line.startsWith('D')).toBe(true);
      }
    } finally {
      if (before !== null) {
        require('node:fs').writeFileSync(CACHE_SNAPSHOT_PATH, before);
      }
    }
  });

  it("le fichier orphelin \"0].{name\" n'existe plus ni dans Git ni sur disque", () => {
    const lsFiles = git(['ls-files', '--', ORPHAN_FILE_NAME]);
    expect(lsFiles.status).toBe(0);
    expect(lsFiles.stdout.trim()).toBe('');
    expect(existsSync(join(REPO_ROOT, ORPHAN_FILE_NAME))).toBe(false);
  });
});

describe('Repo hygiene — build Docker non impacté', () => {
  it("Dockerfile ne copie ni n'attend le dossier cache/ dans l'image finale", () => {
    const dockerfile = readFileSync(DOCKERFILE_PATH, 'utf-8');
    expect(dockerfile).not.toMatch(/cache\//);

    // Seuls dist/, node_modules/ et package.json doivent être copiés dans le
    // stage runtime (dernier stage FROM ... AS runner).
    const runnerStage = dockerfile.slice(dockerfile.indexOf('AS runner'));
    const copyLines = runnerStage
      .split('\n')
      .filter((line) => line.trim().startsWith('COPY'));
    expect(copyLines.length).toBeGreaterThan(0);
    for (const line of copyLines) {
      expect(line).toMatch(/dist|node_modules|package\.json/);
    }
  });

  it(".dockerignore ne référence pas cache/ (rien à exclure explicitement, absence de copie suffit)", () => {
    if (!existsSync(DOCKERIGNORE_PATH)) return;
    const dockerignore = readFileSync(DOCKERIGNORE_PATH, 'utf-8');
    expect(dockerignore).not.toMatch(/cache\//);
  });
});
