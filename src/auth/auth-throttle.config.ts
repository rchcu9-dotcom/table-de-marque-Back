import type { ThrottlerModuleOptions } from '@nestjs/throttler';

const DEFAULT_TTL_MS = 60_000;
const DEFAULT_LIMIT = 20;
const DEFAULT_DEV_LOGIN_LIMIT = 5;

export interface AuthThrottleConfig {
  enabled: boolean;
  ttlMs: number;
  limit: number;
  devLoginLimit: number;
}

/** Entier strictement positif, sinon le défaut : un limit=0 couperait toute connexion. */
function entierPositif(valeur: string | undefined, defaut: number): number {
  const brut = (valeur ?? '').trim();
  if (!/^\d+$/.test(brut)) return defaut;
  const nombre = Number(brut);
  return Number.isSafeInteger(nombre) && nombre > 0 ? nombre : defaut;
}

export function readAuthThrottleConfig(
  env: NodeJS.ProcessEnv = process.env,
): AuthThrottleConfig {
  return {
    // Seule la valeur exacte `false` désactive : toute autre valeur laisse le
    // throttler actif, pour échouer du côté sûr.
    enabled: env.THROTTLE_ENABLED !== 'false',
    ttlMs: entierPositif(env.AUTH_THROTTLE_TTL_MS, DEFAULT_TTL_MS),
    limit: entierPositif(env.AUTH_THROTTLE_LIMIT, DEFAULT_LIMIT),
    devLoginLimit: entierPositif(
      env.AUTH_DEV_LOGIN_THROTTLE_LIMIT,
      DEFAULT_DEV_LOGIN_LIMIT,
    ),
  };
}

/**
 * Limites des routes /auth/*, résolues à chaque requête et non au chargement du module.
 *
 * Forme objet obligatoire : avec la forme tableau, le guard ignore `skipIf`.
 * Throttler non nommé (`default`) : sinon l'en-tête devient `Retry-After-<nom>`.
 */
export function buildAuthThrottlerOptions(): ThrottlerModuleOptions {
  return {
    throttlers: [
      {
        ttl: () => readAuthThrottleConfig().ttlMs,
        limit: () => readAuthThrottleConfig().limit,
      },
    ],
    skipIf: () => !readAuthThrottleConfig().enabled,
  };
}
