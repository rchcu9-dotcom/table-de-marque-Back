import request from 'supertest';
import { DossierController } from '@/inscription/infrastructure/http/dossier.controller';
import { GetMonDossierUseCase } from '@/inscription/application/dossier/get-mon-dossier.usecase';
import { GetDossierParInscriptionUseCase } from '@/inscription/application/dossier/get-dossier-par-inscription.usecase';
import { AjouterJoueurUseCase } from '@/inscription/application/dossier/ajouter-joueur.usecase';
import { ModifierJoueurUseCase } from '@/inscription/application/dossier/modifier-joueur.usecase';
import { SupprimerJoueurUseCase } from '@/inscription/application/dossier/supprimer-joueur.usecase';
import { AjouterCoachUseCase } from '@/inscription/application/dossier/ajouter-coach.usecase';
import { ModifierCoachUseCase } from '@/inscription/application/dossier/modifier-coach.usecase';
import { SupprimerCoachUseCase } from '@/inscription/application/dossier/supprimer-coach.usecase';
import { AccepterDroitsImageUseCase } from '@/inscription/application/dossier/accepter-droits-image.usecase';
import {
  buildInscriptionTestApp,
  givenRole,
  type InscriptionTestApp,
} from './support/inscription-test-app';

describe('DossierController (integration)', () => {
  let testApp: InscriptionTestApp;

  const getMonDossierUseCase = { execute: jest.fn() };
  const getDossierParInscriptionUseCase = { execute: jest.fn() };
  const ajouterJoueurUseCase = { execute: jest.fn() };
  const modifierJoueurUseCase = { execute: jest.fn() };
  const supprimerJoueurUseCase = { execute: jest.fn() };
  const ajouterCoachUseCase = { execute: jest.fn() };
  const modifierCoachUseCase = { execute: jest.fn() };
  const supprimerCoachUseCase = { execute: jest.fn() };
  const accepterDroitsImageUseCase = { execute: jest.fn() };

  beforeAll(async () => {
    testApp = await buildInscriptionTestApp(
      [DossierController],
      [
        { provide: GetMonDossierUseCase, useValue: getMonDossierUseCase },
        {
          provide: GetDossierParInscriptionUseCase,
          useValue: getDossierParInscriptionUseCase,
        },
        { provide: AjouterJoueurUseCase, useValue: ajouterJoueurUseCase },
        { provide: ModifierJoueurUseCase, useValue: modifierJoueurUseCase },
        { provide: SupprimerJoueurUseCase, useValue: supprimerJoueurUseCase },
        { provide: AjouterCoachUseCase, useValue: ajouterCoachUseCase },
        { provide: ModifierCoachUseCase, useValue: modifierCoachUseCase },
        { provide: SupprimerCoachUseCase, useValue: supprimerCoachUseCase },
        {
          provide: AccepterDroitsImageUseCase,
          useValue: accepterDroitsImageUseCase,
        },
      ],
    );
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /inscription/dossier/moi', () => {
    it('returns 401 without authentication', async () => {
      await request(testApp.app.getHttpServer())
        .get('/inscription/dossier/moi')
        .expect(401);

      expect(getMonDossierUseCase.execute).not.toHaveBeenCalled();
    });

    it('returns 200 and calls the use case with the firebase uid for any authenticated user', async () => {
      getMonDossierUseCase.execute.mockResolvedValue({
        dossier: null,
        joueurs: [],
        coachs: [],
        statutInscription: 'VALIDEE',
      });

      const res = await request(testApp.app.getHttpServer())
        .get('/inscription/dossier/moi')
        .set('Authorization', 'Bearer responsable-1')
        .expect(200);

      expect(res.body.statutInscription).toBe('VALIDEE');
      expect(getMonDossierUseCase.execute).toHaveBeenCalledWith(
        'responsable-1',
      );
    });
  });

  describe('GET /inscription/dossier/candidature/:id (ORGANISATEUR only)', () => {
    it('returns 401 without authentication', async () => {
      await request(testApp.app.getHttpServer())
        .get('/inscription/dossier/candidature/1')
        .expect(401);

      expect(getDossierParInscriptionUseCase.execute).not.toHaveBeenCalled();
    });

    it('returns 403 for RESPONSABLE_EQUIPE', async () => {
      givenRole(testApp.prisma, 'RESPONSABLE_EQUIPE');

      await request(testApp.app.getHttpServer())
        .get('/inscription/dossier/candidature/1')
        .set('Authorization', 'Bearer responsable-1')
        .expect(403);

      expect(getDossierParInscriptionUseCase.execute).not.toHaveBeenCalled();
    });

    it('returns 200 and calls the use case for ORGANISATEUR', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');
      getDossierParInscriptionUseCase.execute.mockResolvedValue({
        dossier: null,
        joueurs: [],
        coachs: [],
        statutInscription: 'DOSSIER_EN_COURS',
      });

      const res = await request(testApp.app.getHttpServer())
        .get('/inscription/dossier/candidature/1')
        .set('Authorization', 'Bearer organisateur-1')
        .expect(200);

      expect(res.body.statutInscription).toBe('DOSSIER_EN_COURS');
      expect(getDossierParInscriptionUseCase.execute).toHaveBeenCalledWith(1);
    });
  });

  type RouteCase = {
    name: string;
    method: 'post' | 'patch' | 'delete';
    path: string;
    body?: Record<string, unknown>;
    useCase: { execute: jest.Mock };
    expectedArgs: unknown[];
    successResult: unknown;
  };

  const routeCases: RouteCase[] = [
    {
      name: 'POST /inscription/dossier/joueurs',
      method: 'post',
      path: '/inscription/dossier/joueurs',
      body: { nom: 'Gretzky', prenom: 'Wayne', numero: 99, poste: 'A' },
      useCase: ajouterJoueurUseCase,
      expectedArgs: [
        'responsable-1',
        { nom: 'Gretzky', prenom: 'Wayne', numero: 99, poste: 'A' },
      ],
      successResult: { id: 1, nom: 'Gretzky' },
    },
    {
      name: 'PATCH /inscription/dossier/joueurs/:id',
      method: 'patch',
      path: '/inscription/dossier/joueurs/1',
      body: { nom: 'Lemieux' },
      useCase: modifierJoueurUseCase,
      expectedArgs: ['responsable-1', 1, { nom: 'Lemieux' }],
      successResult: { id: 1, nom: 'Lemieux' },
    },
    {
      name: 'DELETE /inscription/dossier/joueurs/:id',
      method: 'delete',
      path: '/inscription/dossier/joueurs/1',
      useCase: supprimerJoueurUseCase,
      expectedArgs: ['responsable-1', 1],
      successResult: undefined,
    },
    {
      name: 'POST /inscription/dossier/coachs',
      method: 'post',
      path: '/inscription/dossier/coachs',
      body: { nom: 'Bowman', prenom: 'Scotty' },
      useCase: ajouterCoachUseCase,
      expectedArgs: ['responsable-1', { nom: 'Bowman', prenom: 'Scotty' }],
      successResult: { id: 1, nom: 'Bowman' },
    },
    {
      name: 'PATCH /inscription/dossier/coachs/:id',
      method: 'patch',
      path: '/inscription/dossier/coachs/1',
      body: { presenceRepas: true },
      useCase: modifierCoachUseCase,
      expectedArgs: ['responsable-1', 1, { presenceRepas: true }],
      successResult: { id: 1, presenceRepas: true },
    },
    {
      name: 'DELETE /inscription/dossier/coachs/:id',
      method: 'delete',
      path: '/inscription/dossier/coachs/1',
      useCase: supprimerCoachUseCase,
      expectedArgs: ['responsable-1', 1],
      successResult: undefined,
    },
    {
      name: 'PATCH /inscription/dossier/droits-image',
      method: 'patch',
      path: '/inscription/dossier/droits-image',
      body: { accepte: true },
      useCase: accepterDroitsImageUseCase,
      expectedArgs: ['responsable-1', { accepte: true }],
      successResult: { id: 5, droitsImageAcceptes: true },
    },
  ];

  function makeRequest(method: RouteCase['method'], path: string) {
    const agent = request(testApp.app.getHttpServer());
    if (method === 'post') return agent.post(path);
    if (method === 'patch') return agent.patch(path);
    return agent.delete(path);
  }

  describe.each(routeCases)(
    '$name',
    ({ method, path, body, useCase, expectedArgs, successResult }) => {
      it('returns 401 without authentication and does not call the use case', async () => {
        const req = makeRequest(method, path);
        if (body) req.send(body);

        await req.expect(401);

        expect(useCase.execute).not.toHaveBeenCalled();
      });

      it('calls the use case with the firebase uid and forwarded arguments for an authenticated user', async () => {
        useCase.execute.mockResolvedValue(successResult);

        const req = makeRequest(method, path).set(
          'Authorization',
          'Bearer responsable-1',
        );
        if (body) req.send(body);

        await req.expect((res) => {
          if (res.status >= 400) {
            throw new Error(`unexpected status ${res.status}: ${JSON.stringify(res.body)}`);
          }
        });

        expect(useCase.execute).toHaveBeenCalledWith(...expectedArgs);
      });
    },
  );
});
