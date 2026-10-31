import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { resolveAccess } from '@/auth/access-policy';
import { AuthGuard } from '@/auth/auth.guard';
import { AuthPrismaService } from '@/auth/auth-prisma.service';
import {
  discoverControllers,
  listRoutes,
  type RouteInventoryEntry,
} from './support/route-inventory';

// docs/specs/rendre-le-guard-global-priv-par-dfaut-avec-un-dcorateur-publ.md — critères 6 et 8
// Toutes les routes de l'AppModule, sur le vrai routeur Express et le vrai AuthGuard. Seuls les
// providers sont remplacés : AppModule complet n'est pas montable sans base.

const SECRET = 'secret-de-test';
const FLUX_SSE = ['/matches/stream', '/challenge/stream', '/live/stream'];

function bouchon(): object {
  return new Proxy(
    {},
    {
      // Un `then` ferait passer le bouchon pour une promesse, que Nest attendrait indéfiniment.
      get: (_cible, cle) => (cle === 'then' ? undefined : jest.fn()),
    },
  );
}

describe('Accès aux routes de l’AppModule', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let base: string;
  let routes: RouteInventoryEntry[];
  const findUnique = jest.fn();

  /** S'arrête aux en-têtes : les flux SSE ne se terminent jamais d'eux-mêmes. */
  async function statut(route: string, token?: string): Promise<number> {
    const [verbe, chemin] = route.split(' ');
    const abandon = new AbortController();
    const reponse = await fetch(base + chemin.replace(/:\w+/g, '1'), {
      method: verbe,
      redirect: 'manual',
      signal: abandon.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    abandon.abort();
    return reponse.status;
  }

  async function statuts(liste: RouteInventoryEntry[], token?: string) {
    return Promise.all(
      liste.map(async ({ route }) => ({
        route,
        statut: await statut(route, token),
      })),
    );
  }

  const publiques = () =>
    routes.filter((r) => resolveAccess(r.metadata) === 'public');
  const protegees = () =>
    routes.filter((r) => resolveAccess(r.metadata) !== 'public');

  beforeAll(async () => {
    // AuthModule lit ce secret dès son chargement. Aucune variable lue par `isGoogleOAuthConfigured`
    // ne doit subsister : les routes Google doivent répondre 503 quel que soit le poste.
    process.env.JWT_SECRET ??= SECRET;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    jest.spyOn(console, 'log').mockImplementation();

    const { AppModule } =
      jest.requireActual<typeof import('@/app.module')>('@/app.module');
    const controleurs = discoverControllers(AppModule);
    routes = listRoutes(controleurs);

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: SECRET })],
      controllers: controleurs,
      providers: [
        AuthGuard,
        { provide: APP_GUARD, useExisting: AuthGuard },
        {
          provide: AuthPrismaService,
          useValue: { inscUtilisateur: { findUnique } },
        },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .useMocker(bouchon)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
    jwt = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it('le montage expose bien les routes publiques et protégées', () => {
    expect(publiques().length).toBeGreaterThan(0);
    expect(protegees().length).toBeGreaterThan(0);
  });

  it('aucune route publique ne répond 401 sans token (critère 6)', async () => {
    const resultats = await statuts(publiques());

    expect(resultats.filter((r) => r.statut === 401)).toEqual([]);
  });

  it('toute route protégée répond 401 sans token (critère 8)', async () => {
    const resultats = await statuts(protegees());

    expect(resultats.filter((r) => r.statut !== 401)).toEqual([]);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('toute route à rôle répond 403 à un rôle hors liste (critère 8)', async () => {
    findUnique.mockResolvedValue({
      id: 1,
      providerUid: 'uid-1',
      role: 'AUCUN',
    });
    const token = await jwt.signAsync({ sub: 'uid-1', email: 'a@b.fr' });
    const aRole = protegees().filter(
      (r) => resolveAccess(r.metadata) !== 'authenticated',
    );

    const resultats = await statuts(aRole, token);

    expect(aRole.length).toBeGreaterThan(0);
    expect(resultats.filter((r) => r.statut !== 403)).toEqual([]);
  });

  it('GET /health répond 200 sans token : la sonde reste verte (critère 9)', async () => {
    expect(await statut('GET /health')).toBe(200);
  });

  it.each(FLUX_SSE)('GET %s s’ouvre sans token', async (chemin) => {
    expect(await statut(`GET ${chemin}`)).toBe(200);
  });

  it.each(['GET /auth/google', 'GET /auth/google/callback'])(
    '%s franchit le guard global et atteint son guard de méthode',
    async (route) => {
      expect(await statut(route)).toBe(503);
    },
  );
});
