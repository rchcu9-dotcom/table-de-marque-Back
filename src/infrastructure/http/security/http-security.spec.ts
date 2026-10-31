import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import {
  buildHelmetOptions,
  configureHttpSecurity,
  resolveCorsOrigins,
  resolveTrustProxyHops,
} from './http-security';

/** En-têtes réellement posés par helmet avec les options de l'application. */
function enTetesHelmet(): Record<string, unknown> {
  const poses: Record<string, unknown> = { 'X-Powered-By': 'Express' };
  const res = {
    setHeader: (nom: string, valeur: unknown) => {
      poses[nom] = valeur;
    },
    removeHeader: (nom: string) => {
      delete poses[nom];
    },
  };
  const middleware = helmet(buildHelmetOptions()) as unknown as (
    req: unknown,
    res: unknown,
    next: () => void,
  ) => void;
  middleware({}, res, () => undefined);
  return poses;
}

describe('buildHelmetOptions (CA15)', () => {
  it('autorise le chargement cross-origin des images', () => {
    expect(enTetesHelmet()['Cross-Origin-Resource-Policy']).toBe(
      'cross-origin',
    );
  });

  it('retire X-Powered-By', () => {
    expect(enTetesHelmet()).not.toHaveProperty('X-Powered-By');
  });

  it('ne transmet pas le référent : le JWT passe dans l’URL du callback', () => {
    expect(enTetesHelmet()['Referrer-Policy']).toBe('no-referrer');
  });

  it('pose une CSP fermée, sans les directives par défaut de helmet', () => {
    expect(enTetesHelmet()['Content-Security-Policy']).toBe(
      "default-src 'none';frame-ancestors 'none'",
    );
  });

  it('fixe HSTS à 180 jours, et non aux 365 jours par défaut de helmet 8', () => {
    expect(enTetesHelmet()['Strict-Transport-Security']).toBe(
      'max-age=15552000; includeSubDomains',
    );
  });

  it('conserve les défauts utiles', () => {
    const enTetes = enTetesHelmet();

    expect(enTetes['X-Content-Type-Options']).toBe('nosniff');
    expect(enTetes['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(enTetes['Cross-Origin-Opener-Policy']).toBe('same-origin');
  });

  it('ne pose pas Cross-Origin-Embedder-Policy', () => {
    expect(enTetesHelmet()).not.toHaveProperty('Cross-Origin-Embedder-Policy');
  });
});

describe('resolveCorsOrigins', () => {
  it('retombe sur les 4 origines par défaut sans CORS_ORIGINS', () => {
    expect(resolveCorsOrigins({})).toEqual([
      'http://localhost:5173',
      'https://sttablemarque.z6.web.core.windows.net',
      'https://table-de-marque-72e86.web.app',
      'https://table-de-marque-72e86.firebaseapp.com',
    ]);
  });

  it('traite une valeur vide comme une absence', () => {
    expect(resolveCorsOrigins({ CORS_ORIGINS: '' })).toHaveLength(4);
  });

  it('découpe la liste en retirant espaces et entrées vides', () => {
    expect(
      resolveCorsOrigins({ CORS_ORIGINS: ' https://a.fr , ,https://b.fr ' }),
    ).toEqual(['https://a.fr', 'https://b.fr']);
  });
});

describe('resolveTrustProxyHops', () => {
  it('vaut 1 par défaut', () => {
    expect(resolveTrustProxyHops({})).toBe(1);
  });

  it.each([
    ['0', 0],
    ['1', 1],
    ['2', 2],
    [' 2 ', 2],
  ])('lit « %s » comme le nombre %d', (valeur, attendu) => {
    expect(resolveTrustProxyHops({ TRUST_PROXY_HOPS: valeur })).toBe(attendu);
  });

  it.each([['abc'], ['-1'], ['1.5'], [''], ['true'], ['99999999999999999999']])(
    'ramène « %s » à 1',
    (valeur) => {
      expect(resolveTrustProxyHops({ TRUST_PROXY_HOPS: valeur })).toBe(1);
    },
  );
});

describe('configureHttpSecurity', () => {
  const envInitial = process.env.TRUST_PROXY_HOPS;

  afterEach(() => {
    if (envInitial === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = envInitial;
  });

  function appFactice() {
    const appels: string[] = [];
    const app = {
      set: jest.fn(() => appels.push('set')),
      use: jest.fn(() => appels.push('use')),
      enableCors: jest.fn(() => appels.push('enableCors')),
    };
    return { app, appels };
  }

  it('applique trust proxy, helmet puis CORS, dans cet ordre', () => {
    const { app, appels } = appFactice();

    configureHttpSecurity(app as unknown as INestApplication);

    expect(appels).toEqual(['set', 'use', 'enableCors']);
  });

  it('transmet à Express un nombre, jamais une chaîne', () => {
    process.env.TRUST_PROXY_HOPS = '2';
    const { app } = appFactice();

    configureHttpSecurity(app as unknown as INestApplication);

    expect(app.set).toHaveBeenCalledWith('trust proxy', 2);
  });
});
