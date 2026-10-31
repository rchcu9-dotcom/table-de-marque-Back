import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet, { type HelmetOptions } from 'helmet';

const DEFAULT_TRUST_PROXY_HOPS = 1;

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'https://sttablemarque.z6.web.core.windows.net',
  'https://table-de-marque-72e86.web.app',
  'https://table-de-marque-72e86.firebaseapp.com',
];

export function buildHelmetOptions(): HelmetOptions {
  return {
    // L'API ne rend aucune page : JSON, images, SSE, et un export HTML en pièce jointe.
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    // Le front, sur une autre origine, charge en <img> /presentation/image/:fileId.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Le JWT transite dans l'URL du callback OAuth.
    referrerPolicy: { policy: 'no-referrer' },
    // Explicite : le défaut de helmet 8 est de 365 jours.
    strictTransportSecurity: { maxAge: 15552000, includeSubDomains: true },
  };
}

export function resolveCorsOrigins(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const envOrigins = env.CORS_ORIGINS;
  return envOrigins
    ? envOrigins
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : DEFAULT_CORS_ORIGINS;
}

/** Entier >= 0, sinon 1. Reste un nombre : Express lirait '1' comme une liste d'adresses. */
export function resolveTrustProxyHops(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const brut = (env.TRUST_PROXY_HOPS ?? '').trim();
  if (!/^\d+$/.test(brut)) return DEFAULT_TRUST_PROXY_HOPS;
  const hops = Number(brut);
  return Number.isSafeInteger(hops) ? hops : DEFAULT_TRUST_PROXY_HOPS;
}

/**
 * Point d'entrée unique, partagé avec les tests d'intégration : trust proxy, helmet,
 * puis CORS. À appeler avant app.init() / app.listen() : après, helmet passerait
 * derrière le routeur et les routes sortiraient sans en-têtes.
 */
export function configureHttpSecurity(app: INestApplication): void {
  (app as NestExpressApplication).set('trust proxy', resolveTrustProxyHops());
  app.use(helmet(buildHelmetOptions()));
  app.enableCors({ origin: resolveCorsOrigins() });
}
