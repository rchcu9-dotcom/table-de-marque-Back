import request from 'supertest';
import { CandidatureController } from '@/inscription/infrastructure/http/candidature.controller';
import { SoumettreCanditatureUseCase } from '@/inscription/application/candidature/soumettre-candidature.usecase';
import { GetMaCandidatureUseCase } from '@/inscription/application/candidature/get-ma-candidature.usecase';
import { GetToutesCandidaturesUseCase } from '@/inscription/application/candidature/get-toutes-candidatures.usecase';
import { AccepterCandidatureUseCase } from '@/inscription/application/candidature/accepter-candidature.usecase';
import { MettreListeAttenteUseCase } from '@/inscription/application/candidature/mettre-liste-attente.usecase';
import { RefuserCandidatureUseCase } from '@/inscription/application/candidature/refuser-candidature.usecase';
import { ValiderPaiementUseCase } from '@/inscription/application/candidature/valider-paiement.usecase';
import { PromouvoCandidatureUseCase } from '@/inscription/application/candidature/promouvoir-candidature.usecase';
import { ValiderDossierUseCase } from '@/inscription/application/candidature/valider-dossier.usecase';
import { RouvrirDossierUseCase } from '@/inscription/application/candidature/rouvrir-dossier.usecase';
import {
  buildInscriptionTestApp,
  givenRole,
  type InscriptionTestApp,
} from './support/inscription-test-app';

describe('CandidatureController (integration)', () => {
  let testApp: InscriptionTestApp;

  const soumettreUseCase = { execute: jest.fn() };
  const getMaCandidatureUseCase = { execute: jest.fn() };
  const getToutesCandidaturesUseCase = { execute: jest.fn() };
  const accepterUseCase = { execute: jest.fn() };
  const listeAttenteUseCase = { execute: jest.fn() };
  const refuserUseCase = { execute: jest.fn() };
  const validerPaiementUseCase = { execute: jest.fn() };
  const promouvoirUseCase = { execute: jest.fn() };
  const validerDossierUseCase = { execute: jest.fn() };
  const rouvrirDossierUseCase = { execute: jest.fn() };

  beforeAll(async () => {
    testApp = await buildInscriptionTestApp(
      [CandidatureController],
      [
        { provide: SoumettreCanditatureUseCase, useValue: soumettreUseCase },
        { provide: GetMaCandidatureUseCase, useValue: getMaCandidatureUseCase },
        {
          provide: GetToutesCandidaturesUseCase,
          useValue: getToutesCandidaturesUseCase,
        },
        { provide: AccepterCandidatureUseCase, useValue: accepterUseCase },
        { provide: MettreListeAttenteUseCase, useValue: listeAttenteUseCase },
        { provide: RefuserCandidatureUseCase, useValue: refuserUseCase },
        {
          provide: ValiderPaiementUseCase,
          useValue: validerPaiementUseCase,
        },
        { provide: PromouvoCandidatureUseCase, useValue: promouvoirUseCase },
        { provide: ValiderDossierUseCase, useValue: validerDossierUseCase },
        { provide: RouvrirDossierUseCase, useValue: rouvrirDossierUseCase },
      ],
    );
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /inscription/candidatures', () => {
    const dto = { equipeRefId: 5 };

    it('returns 401 without authentication and does not call the use case', async () => {
      await request(testApp.app.getHttpServer())
        .post('/inscription/candidatures')
        .send(dto)
        .expect(401);

      expect(soumettreUseCase.execute).not.toHaveBeenCalled();
    });

    it('returns 403 for an authenticated ORGANISATEUR (symmetric rejection)', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');

      await request(testApp.app.getHttpServer())
        .post('/inscription/candidatures')
        .set('Authorization', 'Bearer organisateur-1')
        .send(dto)
        .expect(403);

      expect(soumettreUseCase.execute).not.toHaveBeenCalled();
    });

    it('returns 401 when no InscUtilisateur matches the authenticated user', async () => {
      givenRole(testApp.prisma, null);

      await request(testApp.app.getHttpServer())
        .post('/inscription/candidatures')
        .set('Authorization', 'Bearer inconnu-1')
        .send(dto)
        .expect(401);

      expect(soumettreUseCase.execute).not.toHaveBeenCalled();
    });

    it('returns 201 and calls the use case with the firebase uid for RESPONSABLE_EQUIPE', async () => {
      givenRole(testApp.prisma, 'RESPONSABLE_EQUIPE');
      soumettreUseCase.execute.mockResolvedValue({
        id: 1,
        equipeNom: 'Equipe A',
        statut: 'CANDIDATE',
        createdAt: '2026-01-01T00:00:00.000Z',
      });

      const res = await request(testApp.app.getHttpServer())
        .post('/inscription/candidatures')
        .set('Authorization', 'Bearer responsable-1')
        .send(dto)
        .expect(201);

      expect(res.body.id).toBe(1);
      expect(soumettreUseCase.execute).toHaveBeenCalledWith(
        'responsable-1',
        dto,
      );
    });
  });

  describe('GET /inscription/candidatures/ma-candidature', () => {
    it('returns 401 without authentication and does not call the use case', async () => {
      await request(testApp.app.getHttpServer())
        .get('/inscription/candidatures/ma-candidature')
        .expect(401);

      expect(getMaCandidatureUseCase.execute).not.toHaveBeenCalled();
    });

    it.each(['responsable-1', 'organisateur-1'] as const)(
      'returns 200 for any authenticated user regardless of InscUtilisateur role (uid=%s)',
      async (uid) => {
        getMaCandidatureUseCase.execute.mockResolvedValue({
          id: 1,
          equipeNom: 'Equipe A',
          equipeLogoUrl: null,
          statut: 'CANDIDATE',
          createdAt: '2026-01-01T00:00:00.000Z',
        });

        const res = await request(testApp.app.getHttpServer())
          .get('/inscription/candidatures/ma-candidature')
          .set('Authorization', `Bearer ${uid}`)
          .expect(200);

        expect(res.body.id).toBe(1);
        expect(getMaCandidatureUseCase.execute).toHaveBeenCalledWith(uid);
      },
    );
  });

  type RouteCase = {
    name: string;
    method: 'get' | 'patch';
    path: string;
    body?: Record<string, unknown>;
    useCase: { execute: jest.Mock };
    expectedArgs: unknown[];
    successResult: unknown;
  };

  const routeCases: RouteCase[] = [
    {
      name: 'GET /inscription/candidatures',
      method: 'get',
      path: '/inscription/candidatures',
      useCase: getToutesCandidaturesUseCase,
      expectedArgs: [],
      successResult: [],
    },
    {
      name: 'PATCH /inscription/candidatures/:id/accepter',
      method: 'patch',
      path: '/inscription/candidatures/1/accepter',
      useCase: accepterUseCase,
      expectedArgs: [1],
      successResult: { id: 1, statut: 'PAIEMENT_ATTENDU' },
    },
    {
      name: 'PATCH /inscription/candidatures/:id/liste-attente',
      method: 'patch',
      path: '/inscription/candidatures/1/liste-attente',
      useCase: listeAttenteUseCase,
      expectedArgs: [1],
      successResult: { id: 1, statut: 'LISTE_ATTENTE' },
    },
    {
      name: 'PATCH /inscription/candidatures/:id/promouvoir',
      method: 'patch',
      path: '/inscription/candidatures/1/promouvoir',
      useCase: promouvoirUseCase,
      expectedArgs: [1],
      successResult: { id: 1, statut: 'PAIEMENT_ATTENDU' },
    },
    {
      name: 'PATCH /inscription/candidatures/:id/refuser',
      method: 'patch',
      path: '/inscription/candidatures/1/refuser',
      useCase: refuserUseCase,
      expectedArgs: [1],
      successResult: { id: 1, statut: 'REFUSEE' },
    },
    {
      name: 'PATCH /inscription/candidatures/:id/valider-paiement',
      method: 'patch',
      path: '/inscription/candidatures/1/valider-paiement',
      body: { dateVirement: '2026-01-15' },
      useCase: validerPaiementUseCase,
      expectedArgs: [1, { dateVirement: '2026-01-15' }],
      successResult: {
        id: 1,
        equipeNom: 'Equipe A',
        statut: 'VALIDEE',
        dateVirementInscription: '2026-01-15T00:00:00.000Z',
        updatedAt: '2026-01-15T00:00:00.000Z',
      },
    },
    {
      name: 'PATCH /inscription/candidatures/:id/valider-dossier',
      method: 'patch',
      path: '/inscription/candidatures/1/valider-dossier',
      useCase: validerDossierUseCase,
      expectedArgs: [1],
      successResult: { id: 1, statut: 'DOSSIER_COMPLET' },
    },
    {
      name: 'PATCH /inscription/candidatures/:id/rouvrir-dossier',
      method: 'patch',
      path: '/inscription/candidatures/1/rouvrir-dossier',
      useCase: rouvrirDossierUseCase,
      expectedArgs: [1],
      successResult: { id: 1, statut: 'DOSSIER_EN_COURS' },
    },
  ];

  function makeRequest(method: 'get' | 'patch', path: string) {
    const agent = request(testApp.app.getHttpServer());
    return method === 'get' ? agent.get(path) : agent.patch(path);
  }

  describe.each(routeCases)(
    '$name (ORGANISATEUR only)',
    ({ method, path, body, useCase, expectedArgs, successResult }) => {
      it('returns 401 without authentication and does not call the use case', async () => {
        const req = makeRequest(method, path);
        if (body) req.send(body);

        await req.expect(401);

        expect(useCase.execute).not.toHaveBeenCalled();
      });

      it('returns 403 when the authenticated user has role RESPONSABLE_EQUIPE and does not call the use case', async () => {
        givenRole(testApp.prisma, 'RESPONSABLE_EQUIPE');

        const req = makeRequest(method, path).set(
          'Authorization',
          'Bearer responsable-1',
        );
        if (body) req.send(body);

        await req.expect(403);

        expect(useCase.execute).not.toHaveBeenCalled();
      });

      it('returns 200 and calls the use case with the right arguments for ORGANISATEUR', async () => {
        givenRole(testApp.prisma, 'ORGANISATEUR');
        useCase.execute.mockResolvedValue(successResult);

        const req = makeRequest(method, path).set(
          'Authorization',
          'Bearer organisateur-1',
        );
        if (body) req.send(body);

        await req.expect(200);

        expect(useCase.execute).toHaveBeenCalledWith(...expectedArgs);
      });
    },
  );
});
