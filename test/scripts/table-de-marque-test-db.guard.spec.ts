const queryRawUnsafe = jest.fn();
const disconnect = jest.fn().mockResolvedValue(undefined);
const prismaCtor = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: function PrismaClient(this: unknown, options: unknown) {
    prismaCtor(options);
    return { $queryRawUnsafe: queryRawUnsafe, $disconnect: disconnect };
  },
}));
jest.mock('dotenv', () => ({ config: jest.fn() }));

import * as dotenv from 'dotenv';
import { openGuardedClient, redact, runMain } from '../../scripts/table-de-marque-test-db/guard';

const TEST_URL = 'mysql://orga:S3cretPassw0rd@mysql-rchcu11.alwaysdata.net:3306/rchcu11_tournoi_test';
const PROD_URL = 'mysql://orga:S3cretPassw0rd@mysql-rchcu11.alwaysdata.net:3306/rchcu11_tournoi';

const savedEnv = { ...process.env };

function givenEnv(env: { DATABASE_URL?: string; DB_NAME?: string }) {
  delete process.env.DATABASE_URL;
  delete process.env.DB_NAME;
  Object.assign(process.env, env);
}

function givenServer(db: string | null, version = '10.11.18-MariaDB') {
  queryRawUnsafe.mockResolvedValue([{ db, version }]);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  process.env = { ...savedEnv };
});

describe('openGuardedClient', () => {
  it('ouvre le client sur une base _test cohérente et renvoie cible + version du serveur', async () => {
    givenEnv({ DATABASE_URL: TEST_URL, DB_NAME: 'rchcu11_tournoi_test' });
    givenServer('rchcu11_tournoi_test');

    const ctx = await openGuardedClient(['--target=rchcu11_tournoi_test']);

    expect(ctx.target).toEqual({
      host: 'mysql-rchcu11.alwaysdata.net',
      port: 3306,
      database: 'rchcu11_tournoi_test',
    });
    expect(ctx.serverVersion).toBe('10.11.18-MariaDB');
    expect(prismaCtor).toHaveBeenCalledWith({ datasources: { db: { url: TEST_URL } } });
    expect(disconnect).not.toHaveBeenCalled();
  });

  it('charge .env.local sans écraser une variable déjà exportée, et sans bruit', async () => {
    givenEnv({ DATABASE_URL: TEST_URL });
    givenServer('rchcu11_tournoi_test');

    await openGuardedClient(['--target=rchcu11_tournoi_test']);

    expect(dotenv.config).toHaveBeenCalledWith(
      expect.objectContaining({ override: false, quiet: true, path: expect.stringMatching(/\.env\.local$/) }),
    );
  });

  it('affiche la base et l\'hôte, jamais les identifiants', async () => {
    givenEnv({ DATABASE_URL: TEST_URL });
    givenServer('rchcu11_tournoi_test');

    await openGuardedClient(['--target=rchcu11_tournoi_test']);

    const printed = (console.log as jest.Mock).mock.calls.flat().join('\n');
    expect(printed).toContain('rchcu11_tournoi_test');
    expect(printed).toContain('mysql-rchcu11.alwaysdata.net');
    expect(printed).not.toMatch(/S3cretPassw0rd|orga:/);
  });

  it('refuse la PRODUCTION avant toute connexion (aucun client créé, aucune requête)', async () => {
    givenEnv({ DATABASE_URL: PROD_URL, DB_NAME: 'rchcu11_tournoi' });

    await expect(openGuardedClient(['--target=rchcu11_tournoi'])).rejects.toThrow(/_test/);

    expect(prismaCtor).not.toHaveBeenCalled();
    expect(queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('refuse sans --target avant toute connexion', async () => {
    givenEnv({ DATABASE_URL: TEST_URL });

    await expect(openGuardedClient([])).rejects.toThrow(/--target/);

    expect(prismaCtor).not.toHaveBeenCalled();
  });

  it('refuse un --target différent avant toute connexion', async () => {
    givenEnv({ DATABASE_URL: TEST_URL });

    await expect(openGuardedClient(['--target=rchcu11_tournoi'])).rejects.toThrow(/diffère/);

    expect(prismaCtor).not.toHaveBeenCalled();
  });

  it('refuse un DB_NAME différent (DATABASE_URL _test mais DB_NAME prod) avant connexion', async () => {
    givenEnv({ DATABASE_URL: TEST_URL, DB_NAME: 'rchcu11_tournoi' });

    await expect(openGuardedClient(['--target=rchcu11_tournoi_test'])).rejects.toThrow(/DB_NAME/);

    expect(prismaCtor).not.toHaveBeenCalled();
  });

  it("refuse quand DATABASE_URL est absente, sans repli sur DB_HOST/DB_NAME", async () => {
    givenEnv({ DB_NAME: 'rchcu11_tournoi_test' });
    process.env.DB_HOST = 'mysql-rchcu11.alwaysdata.net';

    await expect(openGuardedClient(['--target=rchcu11_tournoi_test'])).rejects.toThrow(/DATABASE_URL est absente/);

    expect(prismaCtor).not.toHaveBeenCalled();
  });

  it('refuse un argument inconnu (aucun --force)', async () => {
    givenEnv({ DATABASE_URL: TEST_URL });

    await expect(openGuardedClient(['--target=rchcu11_tournoi_test', '--force'])).rejects.toThrow(/inconnu/);
    expect(prismaCtor).not.toHaveBeenCalled();
  });

  it('refuse et se déconnecte quand SELECT DATABASE() ne concorde pas avec DATABASE_URL', async () => {
    givenEnv({ DATABASE_URL: TEST_URL });
    givenServer('rchcu11_tournoi');

    await expect(openGuardedClient(['--target=rchcu11_tournoi_test'])).rejects.toThrow(/serveur/);

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("refuse et se déconnecte quand le serveur n'a sélectionné aucune base", async () => {
    givenEnv({ DATABASE_URL: TEST_URL });
    givenServer(null);

    await expect(openGuardedClient(['--target=rchcu11_tournoi_test'])).rejects.toThrow(/aucune/);

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('se déconnecte quand la requête de contrôle échoue', async () => {
    givenEnv({ DATABASE_URL: TEST_URL });
    queryRawUnsafe.mockRejectedValue(new Error('connexion refusée'));

    await expect(openGuardedClient(['--target=rchcu11_tournoi_test'])).rejects.toThrow('connexion refusée');

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});

describe('redact', () => {
  it("remplace l'URL de connexion complète", () => {
    givenEnv({ DATABASE_URL: TEST_URL });
    expect(redact(`erreur sur ${TEST_URL} !`)).toBe('erreur sur [DATABASE_URL] !');
  });

  it('masque le mot de passe, y compris encodé, partout dans le message', () => {
    givenEnv({ DATABASE_URL: 'mysql://u:p%40ssW0rd!@h:3306/x_test' });
    const out = redact('Access denied for p@ssW0rd! puis p%40ssW0rd! encore p@ssW0rd!');
    expect(out).not.toMatch(/ssW0rd/);
    expect(out).toContain('***');
  });

  it('ne modifie pas le message quand DATABASE_URL est absente', () => {
    givenEnv({});
    expect(redact('message inchangé')).toBe('message inchangé');
  });

  it('ignore les mots de passe très courts pour ne pas altérer le texte', () => {
    givenEnv({ DATABASE_URL: 'mysql://u:p@h:3306/x_test' });
    expect(redact('Refus : la base est prête')).toBe('Refus : la base est prête');
  });

  it('ne plante pas sur une DATABASE_URL invalide', () => {
    givenEnv({ DATABASE_URL: 'pas une url' });
    expect(redact('abc')).toBe('abc');
  });
});

describe('runMain', () => {
  let exit: jest.SpyInstance;

  beforeEach(() => {
    exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  });

  const flush = () => new Promise((resolve) => setImmediate(resolve));

  it('sort avec le code renvoyé par main', async () => {
    runMain(async () => 2);
    await flush();
    expect(exit).toHaveBeenCalledWith(2);
  });

  it('sort avec 0 quand main ne renvoie rien', async () => {
    runMain(async () => undefined);
    await flush();
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('sort avec 1 et un message redacté quand main lève', async () => {
    givenEnv({ DATABASE_URL: TEST_URL });
    runMain(async () => {
      throw new Error(`échec de connexion à ${TEST_URL}`);
    });
    await flush();

    expect(exit).toHaveBeenCalledWith(1);
    const printed = (console.error as jest.Mock).mock.calls.flat().join('\n');
    expect(printed).toContain('ÉCHEC');
    expect(printed).not.toMatch(/S3cretPassw0rd/);
  });

  it('gère une valeur levée qui n\'est pas une Error', async () => {
    runMain(async () => {
      throw 'texte brut';
    });
    await flush();
    expect(exit).toHaveBeenCalledWith(1);
  });
});
