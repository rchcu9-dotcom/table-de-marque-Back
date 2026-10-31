import type { ExecutionContext } from '@nestjs/common';
import type { ThrottlerOptions } from '@nestjs/throttler';
import {
  buildAuthThrottlerOptions,
  readAuthThrottleConfig,
} from './auth-throttle.config';

describe('readAuthThrottleConfig (CA14, CA15)', () => {
  it('applique les défauts sans aucune variable', () => {
    expect(readAuthThrottleConfig({})).toEqual({
      enabled: true,
      ttlMs: 60000,
      limit: 20,
      devLoginLimit: 5,
    });
  });

  it('lit les surcharges', () => {
    expect(
      readAuthThrottleConfig({
        AUTH_THROTTLE_TTL_MS: '30000',
        AUTH_THROTTLE_LIMIT: '50',
        AUTH_DEV_LOGIN_THROTTLE_LIMIT: '3',
      }),
    ).toEqual({ enabled: true, ttlMs: 30000, limit: 50, devLoginLimit: 3 });
  });

  it('tolère les espaces autour d’un nombre', () => {
    expect(readAuthThrottleConfig({ AUTH_THROTTLE_LIMIT: ' 7 ' }).limit).toBe(
      7,
    );
  });

  it.each([
    ['0'],
    ['-1'],
    ['1.5'],
    ['abc'],
    [''],
    ['1e3'],
    ['99999999999999999999'],
  ])('ramène la valeur invalide « %s » au défaut', (valeur) => {
    expect(
      readAuthThrottleConfig({
        AUTH_THROTTLE_TTL_MS: valeur,
        AUTH_THROTTLE_LIMIT: valeur,
        AUTH_DEV_LOGIN_THROTTLE_LIMIT: valeur,
      }),
    ).toEqual({ enabled: true, ttlMs: 60000, limit: 20, devLoginLimit: 5 });
  });

  it('une variable invalide n’affecte pas les autres', () => {
    expect(
      readAuthThrottleConfig({
        AUTH_THROTTLE_LIMIT: 'abc',
        AUTH_DEV_LOGIN_THROTTLE_LIMIT: '3',
      }),
    ).toMatchObject({ limit: 20, devLoginLimit: 3 });
  });

  it('seule la valeur exacte false désactive', () => {
    expect(readAuthThrottleConfig({ THROTTLE_ENABLED: 'false' }).enabled).toBe(
      false,
    );
  });

  it.each([['true'], ['FALSE'], ['False'], ['0'], ['no'], ['']])(
    'laisse le throttler actif avec « %s »',
    (valeur) => {
      expect(readAuthThrottleConfig({ THROTTLE_ENABLED: valeur }).enabled).toBe(
        true,
      );
    },
  );
});

describe('buildAuthThrottlerOptions', () => {
  const contexte = {} as ExecutionContext;
  const VARIABLES = [
    'AUTH_THROTTLE_TTL_MS',
    'AUTH_THROTTLE_LIMIT',
    'THROTTLE_ENABLED',
  ];
  const envInitial = { ...process.env };

  function options() {
    const construites = buildAuthThrottlerOptions();
    if (Array.isArray(construites)) {
      throw new Error('forme tableau : le guard y ignorerait skipIf');
    }
    return construites;
  }

  const throttler = (): ThrottlerOptions => options().throttlers[0];

  beforeEach(() => {
    for (const nom of VARIABLES) delete process.env[nom];
  });

  afterEach(() => {
    for (const nom of VARIABLES) {
      if (envInitial[nom] === undefined) delete process.env[nom];
      else process.env[nom] = envInitial[nom];
    }
  });

  it('déclare un seul throttler, non nommé : l’en-tête reste Retry-After', () => {
    expect(options().throttlers).toHaveLength(1);
    expect(throttler().name).toBeUndefined();
  });

  it('résout ttl et limit à chaque appel, et non au chargement', () => {
    const { ttl, limit } = throttler();
    const lire = (valeur: unknown): unknown =>
      (valeur as (c: ExecutionContext) => unknown)(contexte);

    expect(lire(ttl)).toBe(60000);
    expect(lire(limit)).toBe(20);

    process.env.AUTH_THROTTLE_TTL_MS = '1000';
    process.env.AUTH_THROTTLE_LIMIT = '2';

    expect(lire(ttl)).toBe(1000);
    expect(lire(limit)).toBe(2);
  });

  it('skipIf suit THROTTLE_ENABLED à chaque appel', () => {
    const { skipIf } = options();

    expect(skipIf?.(contexte)).toBe(false);

    process.env.THROTTLE_ENABLED = 'false';

    expect(skipIf?.(contexte)).toBe(true);
  });
});
