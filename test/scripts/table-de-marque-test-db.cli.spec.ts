import { spawnSync } from 'child_process';
import * as path from 'path';

// Vrais lancements des scripts (tsx) dans un processus séparé : on vérifie que CHAQUE script est
// bien câblé sur le garde-fou et refuse AVANT toute connexion. Les URL ci-dessous sont fictives
// (hôte inexistant) : si un refus n'avait pas lieu avant connexion, le test échouerait sur autre
// chose que le message de refus attendu — et aucun accès réseau réel n'est jamais tenté.

const BACK = path.resolve(__dirname, '../..');
const TSX = path.join(BACK, 'node_modules/tsx/dist/cli.mjs');
const DIR = 'scripts/table-de-marque-test-db';

const FAKE_TEST_URL = 'mysql://user:Passw0rdSecret@invalid.example:3306/rchcu11_tournoi_test';
const FAKE_PROD_URL = 'mysql://user:Passw0rdSecret@invalid.example:3306/rchcu11_tournoi';

function run(script: string, args: string[], env: Record<string, string>) {
  const result = spawnSync(process.execPath, [TSX, `${DIR}/${script}`, ...args], {
    cwd: BACK,
    encoding: 'utf8',
    timeout: 60_000,
    env: { ...process.env, DB_NAME: '', DATABASE_URL: '', ...env },
  });
  return { code: result.status, out: `${result.stdout}\n${result.stderr}` };
}

const SCRIPTS = ['apply-migration.ts', 'verify-schema.ts', 'smoke-match-live.ts'];

describe.each(SCRIPTS)('%s — refus du garde-fou (sans connexion)', (script) => {
  jest.setTimeout(120_000);

  it('refuse sans --target (code 1, message explicite, aucun secret affiché)', () => {
    const { code, out } = run(script, [], { DATABASE_URL: FAKE_TEST_URL });

    expect(code).toBe(1);
    expect(out).toMatch(/--target=<base> est obligatoire/);
    expect(out).not.toMatch(/Passw0rdSecret/);
    expect(out).not.toMatch(/Serveur :/); // jamais arrivé jusqu'à la connexion
  });

  it('refuse la base de PRODUCTION même avec un --target identique', () => {
    const { code, out } = run(script, ['--target=rchcu11_tournoi'], { DATABASE_URL: FAKE_PROD_URL });

    expect(code).toBe(1);
    expect(out).toMatch(/seules les bases se terminant par « _test » sont autorisées/);
    expect(out).not.toMatch(/Cible :/);
    expect(out).not.toMatch(/Passw0rdSecret/);
  });

  it('refuse un --target différent de la base de DATABASE_URL', () => {
    const { code, out } = run(script, ['--target=rchcu11_tournoi'], { DATABASE_URL: FAKE_TEST_URL });

    expect(code).toBe(1);
    expect(out).toMatch(/diffère de la base de DATABASE_URL/);
  });

  it('refuse un argument inconnu (aucun contournement type --force)', () => {
    const { code, out } = run(script, ['--target=rchcu11_tournoi_test', '--force'], { DATABASE_URL: FAKE_TEST_URL });

    expect(code).toBe(1);
    expect(out).toMatch(/Argument inconnu : --force/);
  });
});
