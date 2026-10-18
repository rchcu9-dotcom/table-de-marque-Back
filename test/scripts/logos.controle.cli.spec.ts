import { spawnSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// docs/specs/-nettoyage-des-fichiers-de-logo-contexte-la-gestion-des-fich.md — §5
// Vrais lancements du script (tsx) sur un dossier temporaire : aucune base, aucun
// accès réseau, et le dossier réel des logos n'est jamais visé par une écriture.

const BACK = path.resolve(__dirname, '../..');
const TSX = path.join(BACK, 'node_modules/tsx/dist/cli.mjs');
const SCRIPT = 'scripts/logos/controle-logos.ts';
const OUT_DIR = path.join(BACK, 'scripts/logos/out');

const FAKE_TEST_URL =
  'mysql://user:Passw0rdSecret@invalid.example:3306/rchcu11_tournoi_test';
const FAKE_PROD_URL =
  'mysql://user:Passw0rdSecret@invalid.example:3306/rchcu11_tournoi';

function run(args: string[], env: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, [TSX, SCRIPT, ...args], {
    cwd: BACK,
    encoding: 'utf8',
    timeout: 60_000,
    env: { ...process.env, DB_NAME: '', DATABASE_URL: '', ...env },
  });
  return { code: result.status, out: `${result.stdout}\n${result.stderr}` };
}

function empreintes(dossier: string): Record<string, string> {
  return Object.fromEntries(
    fs
      .readdirSync(dossier)
      .sort()
      .map((nom) => [
        nom,
        crypto
          .createHash('sha256')
          .update(fs.readFileSync(path.join(dossier, nom)))
          .digest('hex'),
      ]),
  );
}

describe('controle-logos.ts — lancement réel sur un dossier temporaire', () => {
  jest.setTimeout(180_000);

  let tmp: string;
  let logos: string;
  let nomsPath: string;
  const instantane = `test-cli-${process.pid}.json`;

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'logos-cli-'));
    logos = path.join(tmp, 'logos');
    fs.mkdirSync(logos);
    fs.writeFileSync(path.join(logos, 'rennes.png'), 'REN');
    fs.writeFileSync(path.join(logos, 'amical-1.png'), 'A1');
    fs.writeFileSync(path.join(logos, 'amicale-1.png'), 'A1');
    fs.writeFileSync(path.join(logos, 'orleans-hexa.svg'), '<svg/>');
    nomsPath = path.join(tmp, 'noms.json');
    fs.writeFileSync(
      nomsPath,
      JSON.stringify(['Rennes', { nom: 'Amical 1' }, 'Le Mans']),
    );
  });

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(path.join(OUT_DIR, instantane), { force: true });
  });

  it('affiche manquants, orphelins et doublons, sans rien modifier dans le dossier', () => {
    const avant = empreintes(logos);

    const { code, out } = run([`--logos=${logos}`, `--noms=liste:${nomsPath}`]);

    expect(code).toBe(0);
    expect(out).toMatch(/4 fichier\(s\)/);
    expect(out).toMatch(/Source « liste » : 3 nom\(s\)/);
    expect(out).toMatch(/Noms sans fichier \(logo manquant\) : 1/);
    expect(out).toMatch(/Le Mans → le-mans\.png \(liste\)/);
    expect(out).toMatch(/Fichiers sans nom \(orphelins\) : 2/);
    expect(out).toMatch(/- amicale-1\.png/);
    expect(out).toMatch(/- orleans-hexa\.svg/);
    expect(out).toMatch(/Groupes de fichiers identiques : 1/);
    expect(out).toMatch(/amical-1\.png = amicale-1\.png/);
    expect(empreintes(logos)).toEqual(avant);
  });

  it("n'ouvre aucune connexion sans --db, même avec une DATABASE_URL de prod dans l'environnement", () => {
    const { code, out } = run(
      [`--logos=${logos}`, `--noms=liste:${nomsPath}`],
      {
        DATABASE_URL: FAKE_PROD_URL,
      },
    );

    expect(code).toBe(0);
    expect(out).not.toMatch(/Cible :|Serveur :/);
    expect(out).not.toMatch(/Passw0rdSecret/);
  });

  it('--strict renvoie 1 tant qu’il reste un manquant, un orphelin ou un doublon', () => {
    const { code } = run([
      `--logos=${logos}`,
      `--noms=liste:${nomsPath}`,
      '--strict',
    ]);

    expect(code).toBe(1);
  });

  it('--strict renvoie 0 sur un dossier propre', () => {
    const propre = path.join(tmp, 'propre');
    fs.mkdirSync(propre);
    fs.writeFileSync(path.join(propre, 'rennes.png'), 'REN');
    const liste = path.join(tmp, 'propre.json');
    fs.writeFileSync(liste, JSON.stringify(['Rennes']));

    const { code, out } = run([
      `--logos=${propre}`,
      `--noms=liste:${liste}`,
      '--strict',
    ]);

    expect(out).toMatch(/Fichiers sans nom \(orphelins\) : 0/);
    expect(code).toBe(0);
  });

  it('--inventaire imprime le tableau Markdown', () => {
    const { out } = run([
      `--logos=${logos}`,
      `--noms=liste:${nomsPath}`,
      '--inventaire',
    ]);

    expect(out).toContain('| Fichier | Justification |');
    expect(out).toContain('| `rennes.png` | « Rennes » (liste) |');
    expect(out).toContain('| `amicale-1.png` | sans nom |');
  });

  it('--seed et --mocks ajoutent chacun 16 noms', () => {
    const { code, out } = run([`--logos=${logos}`, '--seed', '--mocks']);

    expect(code).toBe(0);
    expect(out).toMatch(/Source « seed-2026 » : 16 nom\(s\)/);
    expect(out).toMatch(/Source « mocks » : 16 nom\(s\)/);
    // Mocks : c'est l'identifiant court qui sert de nom, pas le nom long.
    expect(out).toMatch(/Le-Havre → le-havre\.png|Le Havre → le-havre\.png/);
    expect(out).not.toMatch(/rennes-cormorans-hockey-club/);
  });

  it("--instantane écrit sous out/, jamais ailleurs, puis --avant mesure l'écart", () => {
    // Un chemin qui tente de sortir de out/ : seul le nom de fichier est retenu.
    const fuite = path.join(logos, instantane);
    const ecriture = run([
      `--logos=${logos}`,
      `--noms=liste:${nomsPath}`,
      `--instantane=${fuite}`,
    ]);

    expect(ecriture.code).toBe(0);
    expect(fs.existsSync(fuite)).toBe(false);
    expect(fs.existsSync(path.join(OUT_DIR, instantane))).toBe(true);

    // Nettoyage simulé sur une copie : un doublon et le SVG retirés, un fichier renommé.
    const apres = path.join(tmp, 'apres');
    fs.mkdirSync(apres);
    fs.writeFileSync(path.join(apres, 'rennes.png'), 'REN');
    fs.writeFileSync(path.join(apres, 'amical-1.png'), 'A1');

    const comparaison = run([
      `--logos=${apres}`,
      `--noms=liste:${nomsPath}`,
      `--avant=${instantane}`,
    ]);

    expect(comparaison.code).toBe(0);
    expect(comparaison.out).toMatch(/\(4 → 2 fichier\(s\)\)/);
    expect(comparaison.out).toMatch(/Logos perdus : 0/);
    expect(comparaison.out).toMatch(/Fichiers supprimés : 2/);
    expect(comparaison.out).toMatch(/Fichiers ajoutés : 0/);
    expect(comparaison.out).toMatch(/Fichiers au contenu modifié : 0/);
  });

  it('--avant --strict renvoie 1 quand un logo servi a disparu', () => {
    const casse = path.join(tmp, 'casse');
    fs.mkdirSync(casse);
    fs.writeFileSync(path.join(casse, 'amical-1.png'), 'A1');

    const { code, out } = run([
      `--logos=${casse}`,
      `--noms=liste:${nomsPath}`,
      `--avant=${instantane}`,
      '--strict',
    ]);

    expect(out).toMatch(/Logos perdus : 1/);
    expect(out).toMatch(/- Rennes/);
    expect(code).toBe(1);
  });
});

describe('controle-logos.ts — refus', () => {
  jest.setTimeout(180_000);

  it('refuse de tourner sans source de noms', () => {
    const { code, out } = run([]);

    expect(code).toBe(1);
    expect(out).toMatch(/Aucune source de noms/);
  });

  it('refuse un argument inconnu', () => {
    const { code, out } = run(['--seed', '--supprimer']);

    expect(code).toBe(1);
    expect(out).toMatch(/Argument inconnu : --supprimer/);
  });

  it.each(['--noms=fichier.json', '--noms=:fichier.json', '--noms=liste:'])(
    'refuse %s (source ou fichier absent)',
    (arg) => {
      const { code, out } = run([arg]);

      expect(code).toBe(1);
      expect(out).toMatch(/attendu --noms=<source>:<fichier\.json>/);
    },
  );

  it('refuse un fichier de noms mal formé', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'logos-cli-'));
    const mauvais = path.join(tmp, 'mauvais.json');
    fs.writeFileSync(mauvais, JSON.stringify({ nom: 'Rennes' }));

    const { code, out } = run([`--noms=liste:${mauvais}`]);
    fs.rmSync(tmp, { recursive: true, force: true });

    expect(code).toBe(1);
    expect(out).toMatch(/tableau JSON/);
  });

  it('--db sans --target : refus du garde-fou avant toute connexion', () => {
    const { code, out } = run(['--seed', '--db'], {
      DATABASE_URL: FAKE_TEST_URL,
    });

    expect(code).toBe(1);
    expect(out).toMatch(/--target=<base> est obligatoire/);
    expect(out).not.toMatch(/Serveur :/);
    expect(out).not.toMatch(/Passw0rdSecret/);
  });

  it('--db sur la base de PRODUCTION : refus, même avec un --target identique', () => {
    const { code, out } = run(['--seed', '--db', '--target=rchcu11_tournoi'], {
      DATABASE_URL: FAKE_PROD_URL,
    });

    expect(code).toBe(1);
    expect(out).toMatch(
      /seules les bases se terminant par « _test » sont autorisées/,
    );
    expect(out).not.toMatch(/Cible :/);
    expect(out).not.toMatch(/Passw0rdSecret/);
  });
});
