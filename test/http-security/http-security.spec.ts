import * as fs from 'fs';
import * as path from 'path';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  buildHttpSecurityTestApp,
  givenGoogleAccepteLaConnexion,
  type HttpSecurityTestApp,
} from './support/http-security-test-app';

// docs/specs/ajouter-helmet-et-un-rate-limit-throttler-sur-lapi-backsrcma.md — CA16
// CA1 à CA6 (helmet, CORS) et CA8 à CA14 (throttler), sur de vraies réponses HTTP.

const BACK = path.resolve(__dirname, '../..');
const ORIGINE_FRONT = 'https://front.example.com';
const DEV_LOGIN = { email: 'coach@example.com', displayName: 'Coach' };

const VARIABLES = [
  'AUTH_DEV_LOGIN_THROTTLE_LIMIT',
  'AUTH_THROTTLE_LIMIT',
  'AUTH_THROTTLE_TTL_MS',
  'CORS_ORIGINS',
  'ENABLE_DEV_LOGIN',
  'FRONT_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'THROTTLE_ENABLED',
  'TRUST_PROXY_HOPS',
];

function attendre(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Sécurité HTTP de l’API', () => {
  const envInitial = { ...process.env };
  let contexte: HttpSecurityTestApp | undefined;

  const app = (): INestApplication => contexte!.app;
  const devLogin = (ip?: string) => {
    const appel = request(app().getHttpServer()).post('/auth/dev-login');
    if (ip) appel.set('X-Forwarded-For', ip);
    return appel.send(DEV_LOGIN);
  };
  const authGoogle = () => request(app().getHttpServer()).get('/auth/google');

  async function appeler(
    fois: number,
    appel: () => PromiseLike<request.Response>,
  ): Promise<number[]> {
    const statuts: number[] = [];
    for (let i = 0; i < fois; i++) statuts.push((await appel()).status);
    return statuts;
  }

  /** Les variables sont lues à la construction de l'application. */
  async function demarrer(env: Record<string, string> = {}): Promise<void> {
    Object.assign(process.env, env);
    contexte = await buildHttpSecurityTestApp();
  }

  beforeEach(() => {
    for (const nom of VARIABLES) delete process.env[nom];
    process.env.CORS_ORIGINS = ORIGINE_FRONT;
    process.env.ENABLE_DEV_LOGIN = 'true';
    process.env.GOOGLE_CLIENT_ID = 'client-de-test';
    process.env.GOOGLE_CLIENT_SECRET = 'secret-de-test';
    process.env.FRONT_URL = ORIGINE_FRONT;
  });

  afterEach(async () => {
    await contexte?.app.close();
    contexte = undefined;
    for (const nom of VARIABLES) {
      if (envInitial[nom] === undefined) delete process.env[nom];
      else process.env[nom] = envInitial[nom];
    }
  });

  describe('En-têtes de sécurité (CA1, CA2)', () => {
    function verifierEnTetes(res: request.Response): void {
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['strict-transport-security']).toBe(
        'max-age=15552000; includeSubDomains',
      );
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['content-security-policy']).toBe(
        "default-src 'none';frame-ancestors 'none'",
      );
      expect(res.headers['x-powered-by']).toBeUndefined();
    }

    it('couvrent une réponse 200', async () => {
      await demarrer();

      const res = await request(app().getHttpServer()).get('/test-public/ping');

      expect(res.status).toBe(200);
      verifierEnTetes(res);
    });

    it('couvrent une 404', async () => {
      await demarrer();

      const res = await request(app().getHttpServer()).get('/route-inconnue');

      expect(res.status).toBe(404);
      verifierEnTetes(res);
    });

    it('couvrent une 400 de validation', async () => {
      await demarrer();

      const res = await request(app().getHttpServer())
        .post('/auth/dev-login')
        .send({ email: 'pas-un-email' });

      expect(res.status).toBe(400);
      verifierEnTetes(res);
    });

    it('couvrent une redirection OAuth', async () => {
      await demarrer();

      const res = await authGoogle();

      expect(res.status).toBe(302);
      verifierEnTetes(res);
    });

    it('couvrent une 429', async () => {
      await demarrer({ AUTH_DEV_LOGIN_THROTTLE_LIMIT: '1' });
      await devLogin();

      const res = await devLogin();

      expect(res.status).toBe(429);
      verifierEnTetes(res);
    });
  });

  describe('Usages existants conservés (CA3, CA4, CA5)', () => {
    it('le proxy d’images reste chargeable depuis une autre origine (CA3)', async () => {
      await demarrer();

      const res = await request(app().getHttpServer()).get(
        '/presentation/image/abc',
      );

      expect(res.status).toBe(200);
      expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
      expect(res.headers['cache-control']).toBe('public, max-age=3600');
      expect(res.headers['content-type']).toContain('image/jpeg');
    });

    it('le Cache-Control posé par un contrôleur n’est pas écrasé (CA4)', async () => {
      await demarrer();

      const res = await request(app().getHttpServer()).get('/test-public/rib');

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('private, no-store');
    });

    it('un flux SSE garde son type et diffuse ses événements (CA5)', async () => {
      await demarrer();

      const res = await request(app().getHttpServer())
        .get('/test-public/flux')
        .buffer(true);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
      expect(res.text).toContain('data: evenement');
    });
  });

  describe('CORS (CA6)', () => {
    it('autorise une origine de CORS_ORIGINS', async () => {
      await demarrer();

      const res = await request(app().getHttpServer())
        .get('/test-public/ping')
        .set('Origin', ORIGINE_FRONT);

      expect(res.headers['access-control-allow-origin']).toBe(ORIGINE_FRONT);
    });

    it('n’autorise pas une autre origine', async () => {
      await demarrer();

      const res = await request(app().getHttpServer())
        .get('/test-public/ping')
        .set('Origin', 'https://autre.example.com');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('répond aux requêtes préliminaires, avec les en-têtes de sécurité', async () => {
      await demarrer();

      const res = await request(app().getHttpServer())
        .options('/auth/dev-login')
        .set('Origin', ORIGINE_FRONT)
        .set('Access-Control-Request-Method', 'POST');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(ORIGINE_FRONT);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('laisse le front lire une 429', async () => {
      await demarrer({ AUTH_DEV_LOGIN_THROTTLE_LIMIT: '1' });
      await devLogin();

      const res = await devLogin().set('Origin', ORIGINE_FRONT);

      expect(res.status).toBe(429);
      expect(res.headers['access-control-allow-origin']).toBe(ORIGINE_FRONT);
    });
  });

  describe('Connexion Google (CA7, CA9)', () => {
    it('redirige vers Google, sans appel réseau côté back', async () => {
      await demarrer();

      const res = await authGoogle();

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('accounts.google.com');
    });

    it('la redirection vers le front porte le jeton et Referrer-Policy (CA7)', async () => {
      await demarrer();
      givenGoogleAccepteLaConnexion();

      const res = await request(app().getHttpServer()).get(
        '/auth/google/callback?code=abc',
      );

      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(
        new RegExp(`^${ORIGINE_FRONT}/auth/callback\\?token=.+`),
      );
      expect(res.headers['referrer-policy']).toBe('no-referrer');
    });

    it('coupe le 21e appel à /auth/google, sans redirection (CA9)', async () => {
      await demarrer();

      const statuts = await appeler(20, authGoogle);
      const res = await authGoogle();

      expect(statuts).toEqual(Array<number>(20).fill(302));
      expect(res.status).toBe(429);
      expect(res.headers.location).toBeUndefined();
    });

    it('coupe le 21e appel au callback, sans écriture en base', async () => {
      await demarrer();
      givenGoogleAccepteLaConnexion();
      const callback = () =>
        request(app().getHttpServer()).get('/auth/google/callback?code=abc');

      const statuts = await appeler(21, callback);

      expect(statuts.slice(0, 20)).toEqual(Array<number>(20).fill(302));
      expect(statuts[20]).toBe(429);
      expect(contexte!.prisma.inscUtilisateur.create).toHaveBeenCalledTimes(20);
    });

    it('le throttler passe avant GoogleConfiguredGuard : 429 et non 503', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      await demarrer({ AUTH_THROTTLE_LIMIT: '2' });

      expect(await appeler(3, authGoogle)).toEqual([503, 503, 429]);
    });
  });

  describe('Limite de dev-login (CA8)', () => {
    it('sert 5 appels, puis 429 avec Retry-After', async () => {
      await demarrer();

      const statuts = await appeler(5, () => devLogin());
      const res = await devLogin();

      expect(statuts).toEqual([201, 201, 201, 201, 201]);
      expect(res.status).toBe(429);
      expect(res.body).toEqual({
        statusCode: 429,
        message: expect.any(String) as string,
      });
      const retryAfter = Number(res.headers['retry-after']);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60);
    });

    it('n’exécute pas le traitement sur l’appel bloqué', async () => {
      await demarrer();

      await appeler(6, () => devLogin());

      expect(contexte!.prisma.inscUtilisateur.findUnique).toHaveBeenCalledTimes(
        5,
      );
    });

    it('compte aussi les refus : 403 de la route désactivée', async () => {
      await demarrer({ ENABLE_DEV_LOGIN: 'false' });

      expect(await appeler(6, () => devLogin())).toEqual([
        403, 403, 403, 403, 403, 429,
      ]);
    });

    it('compte aussi les erreurs de validation', async () => {
      await demarrer();
      const invalide = () =>
        request(app().getHttpServer()).post('/auth/dev-login').send({});

      expect(await appeler(6, invalide)).toEqual([
        400, 400, 400, 400, 400, 429,
      ]);
    });

    it('a son propre quota, distinct de celui de /auth/google', async () => {
      await demarrer();

      await appeler(6, () => devLogin());

      expect((await authGoogle()).status).toBe(302);
    });

    it('annonce le quota restant sur les réponses non bloquées', async () => {
      await demarrer();

      const res = await devLogin();

      expect(res.headers['x-ratelimit-limit']).toBe('5');
      expect(res.headers['x-ratelimit-remaining']).toBe('4');
    });
  });

  describe('Identification du client (CA10)', () => {
    it('donne à chaque IP cliente son propre quota', async () => {
      await demarrer({ AUTH_DEV_LOGIN_THROTTLE_LIMIT: '2' });

      const client1 = await appeler(3, () => devLogin('203.0.113.1'));
      const client2 = await appeler(3, () => devLogin('203.0.113.2'));

      expect(client1).toEqual([201, 201, 429]);
      expect(client2).toEqual([201, 201, 429]);
    });

    it('ignore la partie de X-Forwarded-For forgée par le client', async () => {
      await demarrer({ AUTH_DEV_LOGIN_THROTTLE_LIMIT: '2' });

      // Le proxy ajoute l'IP réelle à la fin ; le début vient du client.
      const statuts = [
        (await devLogin('1.1.1.1, 203.0.113.1')).status,
        (await devLogin('2.2.2.2, 203.0.113.1')).status,
        (await devLogin('3.3.3.3, 203.0.113.1')).status,
      ];

      expect(statuts).toEqual([201, 201, 429]);
    });

    it('avec TRUST_PROXY_HOPS=2, retient l’avant-dernière adresse', async () => {
      await demarrer({
        AUTH_DEV_LOGIN_THROTTLE_LIMIT: '1',
        TRUST_PROXY_HOPS: '2',
      });

      const statuts = [
        (await devLogin('203.0.113.1, 10.0.0.1')).status,
        (await devLogin('203.0.113.2, 10.0.0.1')).status,
        (await devLogin('203.0.113.2, 10.0.0.2')).status,
      ];

      expect(statuts).toEqual([201, 201, 429]);
    });

    it('avec TRUST_PROXY_HOPS=0, ne fait pas confiance à X-Forwarded-For', async () => {
      await demarrer({
        AUTH_DEV_LOGIN_THROTTLE_LIMIT: '2',
        TRUST_PROXY_HOPS: '0',
      });

      const statuts = [
        (await devLogin('203.0.113.1')).status,
        (await devLogin('203.0.113.2')).status,
        (await devLogin('203.0.113.3')).status,
      ];

      expect(statuts).toEqual([201, 201, 429]);
    });

    it('sans réglage, fait confiance à un seul proxy', async () => {
      await demarrer({ AUTH_DEV_LOGIN_THROTTLE_LIMIT: '1' });

      expect(app().getHttpAdapter().getInstance().get('trust proxy')).toBe(1);
    });
  });

  describe('Fin de la fenêtre (CA11)', () => {
    it('accepte de nouveau les appels après expiration', async () => {
      await demarrer({
        AUTH_THROTTLE_TTL_MS: '500',
        AUTH_DEV_LOGIN_THROTTLE_LIMIT: '2',
      });

      const statuts = await appeler(3, () => devLogin());
      await attendre(650);
      const apres = await devLogin();

      expect(statuts).toEqual([201, 201, 429]);
      expect(apres.status).toBe(201);
    });

    it('reste bloqué tant que la fenêtre n’est pas écoulée', async () => {
      await demarrer({
        AUTH_THROTTLE_TTL_MS: '60000',
        AUTH_DEV_LOGIN_THROTTLE_LIMIT: '1',
      });

      expect(await appeler(3, () => devLogin())).toEqual([201, 429, 429]);
    });
  });

  describe('Routes hors /auth/* (CA12)', () => {
    it('ne limite jamais une route publique : 100 appels depuis la même IP', async () => {
      await demarrer({ AUTH_THROTTLE_LIMIT: '1' });
      const ping = () =>
        request(app().getHttpServer())
          .get('/test-public/ping')
          .set('X-Forwarded-For', '203.0.113.1');

      const statuts = await appeler(100, ping);

      expect(statuts).toEqual(Array<number>(100).fill(200));
    });

    it('n’annonce aucun quota sur une route publique', async () => {
      await demarrer();

      const res = await request(app().getHttpServer()).get('/test-public/ping');

      expect(res.headers['x-ratelimit-limit']).toBeUndefined();
    });

    it('ne limite pas le proxy d’images', async () => {
      await demarrer({ AUTH_THROTTLE_LIMIT: '1' });
      const image = () =>
        request(app().getHttpServer()).get('/presentation/image/abc');

      expect(await appeler(30, image)).toEqual(Array<number>(30).fill(200));
    });

    it('ThrottlerGuard n’est posé que sur AuthController, jamais en global', () => {
      const parcourir = (dossier: string): string[] =>
        fs.readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
          const chemin = path.join(dossier, entree.name);
          if (entree.isDirectory()) return parcourir(chemin);
          return /\.ts$/.test(chemin) && !/\.spec\.ts$/.test(chemin)
            ? [chemin]
            : [];
        });

      const utilisateurs = parcourir(path.join(BACK, 'src'))
        .filter((f) => fs.readFileSync(f, 'utf8').includes('ThrottlerGuard'))
        .map((f) => path.relative(BACK, f).replace(/\\/g, '/'));

      expect(utilisateurs).toEqual(['src/auth/auth.controller.ts']);
    });
  });

  describe('Variables d’environnement (CA13, CA14)', () => {
    it('THROTTLE_ENABLED=false : aucun 429 au-delà des limites (CA13)', async () => {
      await demarrer({ THROTTLE_ENABLED: 'false' });

      expect(await appeler(8, () => devLogin())).toEqual(
        Array<number>(8).fill(201),
      );
      expect(await appeler(22, authGoogle)).toEqual(
        Array<number>(22).fill(302),
      );
    });

    it('une valeur autre que false laisse le throttler actif', async () => {
      await demarrer({
        THROTTLE_ENABLED: '0',
        AUTH_DEV_LOGIN_THROTTLE_LIMIT: '1',
      });

      expect(await appeler(2, () => devLogin())).toEqual([201, 429]);
    });

    it('les surcharges sont appliquées', async () => {
      await demarrer({
        AUTH_THROTTLE_LIMIT: '3',
        AUTH_DEV_LOGIN_THROTTLE_LIMIT: '2',
      });

      expect(await appeler(4, authGoogle)).toEqual([302, 302, 302, 429]);
      expect(await appeler(3, () => devLogin())).toEqual([201, 201, 429]);
    });

    it.each([['abc'], ['0'], ['-1'], ['1.5'], ['']])(
      'la valeur invalide « %s » ramène aux défauts, sans empêcher le démarrage (CA14)',
      async (valeur) => {
        await demarrer({
          AUTH_THROTTLE_TTL_MS: valeur,
          AUTH_THROTTLE_LIMIT: valeur,
          AUTH_DEV_LOGIN_THROTTLE_LIMIT: valeur,
        });

        expect(await appeler(6, () => devLogin())).toEqual([
          201, 201, 201, 201, 201, 429,
        ]);
        const res = await authGoogle();
        expect(res.headers['x-ratelimit-limit']).toBe('20');
      },
    );

    it('les 5 variables sont documentées dans .env.example', () => {
      const exemple = fs.readFileSync(path.join(BACK, '.env.example'), 'utf8');

      for (const ligne of [
        'TRUST_PROXY_HOPS=1',
        'THROTTLE_ENABLED=true',
        'AUTH_THROTTLE_TTL_MS=60000',
        'AUTH_THROTTLE_LIMIT=20',
        'AUTH_DEV_LOGIN_THROTTLE_LIMIT=5',
      ]) {
        expect(exemple).toContain(ligne);
      }
    });
  });

  describe('Bootstrap', () => {
    it('main.ts passe par configureHttpSecurity avant listen, sans CORS en propre', () => {
      const main = fs.readFileSync(path.join(BACK, 'src/main.ts'), 'utf8');

      expect(main.indexOf('configureHttpSecurity(app)')).toBeGreaterThan(-1);
      expect(main.indexOf('configureHttpSecurity(app)')).toBeLessThan(
        main.indexOf('app.listen'),
      );
      expect(main).not.toContain('enableCors');
    });
  });
});
