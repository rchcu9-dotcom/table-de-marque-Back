import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthGuard } from '@/auth/auth.guard';
import { AuthPrismaService } from '@/auth/auth-prisma.service';
import { ChallengeController } from '@/infrastructure/http/challenge/challenge.controller';
import { MatchController } from '@/infrastructure/http/match/match.controller';

// docs/specs/rendre-le-guard-global-priv-par-dfaut-avec-un-dcorateur-publ.md — critère 7
// Vrais contrôleurs, vrai AuthGuard, vrais JWT. Seuls les use cases et Prisma sont remplacés.

const MATCH = {
  id: '1',
  date: '2026-05-23T10:00:00.000Z',
  teamA: 'Rennes',
  teamB: 'Rouen',
  status: 'planned',
};

// Sans corps, `dto` vaut undefined dans createTentative : 500 une fois le guard passé.
const CORPS = { joueurId: '1', metrics: {} };

const ECRITURES: [string, string, 'post' | 'put' | 'delete'][] = [
  ['POST /matches', '/matches', 'post'],
  ['PUT /matches/1', '/matches/1', 'put'],
  ['DELETE /matches/1', '/matches/1', 'delete'],
  [
    'POST /challenge/ateliers/1/tentatives',
    '/challenge/ateliers/1/tentatives',
    'post',
  ],
];

describe('Écritures legacy réservées à ORGANISATEUR', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const findUnique = jest.fn();
  const execute = jest.fn();
  const readOnlyInitial = process.env.API_READ_ONLY;

  function appeler(
    url: string,
    verbe: 'post' | 'put' | 'delete',
    token?: string,
  ) {
    const appel = request(app.getHttpServer())[verbe](url).send(CORPS);
    return token ? appel.set('Authorization', `Bearer ${token}`) : appel;
  }

  async function jetonDe(role: string) {
    findUnique.mockResolvedValue({ id: 1, providerUid: 'uid-1', role });
    return jwt.signAsync({ sub: 'uid-1', email: 'a@b.fr' });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'secret-de-test' })],
      controllers: [MatchController, ChallengeController],
      providers: [
        AuthGuard,
        { provide: APP_GUARD, useExisting: AuthGuard },
        {
          provide: AuthPrismaService,
          useValue: { inscUtilisateur: { findUnique } },
        },
      ],
    })
      .useMocker(() => ({ execute }))
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    jwt = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
    if (readOnlyInitial === undefined) delete process.env.API_READ_ONLY;
    else process.env.API_READ_ONLY = readOnlyInitial;
  });

  beforeEach(() => {
    delete process.env.API_READ_ONLY;
    execute.mockReset();
    execute.mockResolvedValue(MATCH);
    findUnique.mockReset();
  });

  it.each(ECRITURES)('%s : 401 sans token', async (_nom, url, verbe) => {
    const res = await appeler(url, verbe);

    expect(res.status).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });

  describe.each(['RESPONSABLE_EQUIPE', 'TABLE_DE_MARQUE'])(
    'rôle %s',
    (role) => {
      it.each(ECRITURES)('%s : 403', async (_nom, url, verbe) => {
        const res = await appeler(url, verbe, await jetonDe(role));

        expect(res.status).toBe(403);
        expect(execute).not.toHaveBeenCalled();
      });
    },
  );

  it.each(ECRITURES)(
    '%s : acceptée pour ORGANISATEUR',
    async (_nom, url, verbe) => {
      const res = await appeler(url, verbe, await jetonDe('ORGANISATEUR'));

      expect(res.status).toBeLessThan(300);
      expect(execute).toHaveBeenCalledTimes(1);
    },
  );

  it.each(ECRITURES)(
    '%s : API_READ_ONLY refuse encore, même à ORGANISATEUR',
    async (_nom, url, verbe) => {
      process.env.API_READ_ONLY = 'true';

      const res = await appeler(url, verbe, await jetonDe('ORGANISATEUR'));

      expect(res.status).toBe(403);
      expect(res.body.message).toBe(
        'API en mode lecture seule sur cet environnement',
      );
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['/matches'],
    ['/matches/1'],
    ['/challenge/ateliers'],
    ['/challenge/classement-global'],
  ])('la lecture %s reste libre, sans token', async (url) => {
    execute.mockResolvedValue([]);
    if (url === '/matches/1') execute.mockResolvedValue(MATCH);

    const res = await request(app.getHttpServer()).get(url);

    expect(res.status).toBe(200);
  });
});
