import request from 'supertest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { EquipeReferentielController } from '@/inscription/infrastructure/http/equipe-referentiel.controller';
import { GetEquipesReferentielUseCase } from '@/inscription/application/equipe/get-equipes-referentiel.usecase';
import { CreateEquipeReferentielUseCase } from '@/inscription/application/equipe/create-equipe-referentiel.usecase';
import { ValidateEquipeReferentielUseCase } from '@/inscription/application/equipe/validate-equipe-referentiel.usecase';
import { UpdateEquipeReferentielUseCase } from '@/inscription/application/equipe/update-equipe-referentiel.usecase';
import {
  buildInscriptionTestApp,
  givenRole,
  type InscriptionTestApp,
} from './support/inscription-test-app';

describe('EquipeReferentielController (integration)', () => {
  let testApp: InscriptionTestApp;
  let getEquipes: { execute: jest.Mock };
  let createEquipe: { execute: jest.Mock };
  let validateEquipe: { activate: jest.Mock; deactivate: jest.Mock };
  let updateEquipe: { execute: jest.Mock };

  beforeEach(async () => {
    getEquipes = { execute: jest.fn() };
    createEquipe = { execute: jest.fn() };
    validateEquipe = { activate: jest.fn(), deactivate: jest.fn() };
    updateEquipe = { execute: jest.fn() };

    testApp = await buildInscriptionTestApp(
      [EquipeReferentielController],
      [
        { provide: GetEquipesReferentielUseCase, useValue: getEquipes },
        { provide: CreateEquipeReferentielUseCase, useValue: createEquipe },
        {
          provide: ValidateEquipeReferentielUseCase,
          useValue: validateEquipe,
        },
        {
          provide: UpdateEquipeReferentielUseCase,
          useValue: updateEquipe,
        },
      ],
    );
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  describe('GET /inscription/equipes', () => {
    it('is publicly accessible and lists active teams only', async () => {
      getEquipes.execute.mockResolvedValue([{ id: 1, nom: 'Equipe A' }]);

      const res = await request(testApp.app.getHttpServer())
        .get('/inscription/equipes')
        .expect(200);

      expect(res.body).toEqual([{ id: 1, nom: 'Equipe A' }]);
      expect(getEquipes.execute).toHaveBeenCalledWith(false);
    });

    it('never exposes candidatureEnCours (or any other candidature-derived field) in the public response, even if the use case returns it (AC4)', async () => {
      getEquipes.execute.mockResolvedValue([
        {
          id: 1,
          nom: 'Equipe A',
          logoUrl: 'https://example.com/logo.png',
          active: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          candidatureEnCours: true,
        },
      ]);

      const res = await request(testApp.app.getHttpServer())
        .get('/inscription/equipes')
        .expect(200);

      expect(res.body).toEqual([
        {
          id: 1,
          nom: 'Equipe A',
          logoUrl: 'https://example.com/logo.png',
          active: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ]);
      expect(res.body[0]).not.toHaveProperty('candidatureEnCours');
    });

    // docs/specs/-prise-en-compte-du-nom-court-pour-les-logos-contexte-actuel.md — CA9
    it('exposes nomComplet for each team (string or null) and still hides candidatureEnCours', async () => {
      const commun = {
        logoUrl: null,
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      getEquipes.execute.mockResolvedValue([
        {
          id: 1,
          nom: 'Courbevoie',
          nomComplet: 'Les Coqs de Courbevoie',
          ...commun,
          candidatureEnCours: true,
        },
        { id: 2, nom: 'Rennes', nomComplet: null, ...commun, candidatureEnCours: false },
      ]);

      const res = await request(testApp.app.getHttpServer())
        .get('/inscription/equipes')
        .expect(200);

      expect(res.body).toEqual([
        { id: 1, nom: 'Courbevoie', nomComplet: 'Les Coqs de Courbevoie', ...commun },
        { id: 2, nom: 'Rennes', nomComplet: null, ...commun },
      ]);
      for (const equipe of res.body) {
        expect(equipe).not.toHaveProperty('candidatureEnCours');
      }
    });
  });

  describe('GET /inscription/equipes/toutes', () => {
    it('returns 401 without authentication and does not call the use case', async () => {
      await request(testApp.app.getHttpServer())
        .get('/inscription/equipes/toutes')
        .expect(401);

      expect(getEquipes.execute).not.toHaveBeenCalled();
    });

    it('returns 403 when the authenticated user has role RESPONSABLE_EQUIPE', async () => {
      givenRole(testApp.prisma, 'RESPONSABLE_EQUIPE');

      await request(testApp.app.getHttpServer())
        .get('/inscription/equipes/toutes')
        .set('Authorization', 'Bearer responsable-1')
        .expect(403);

      expect(getEquipes.execute).not.toHaveBeenCalled();
    });

    it('returns 401 when no InscUtilisateur matches the authenticated user', async () => {
      givenRole(testApp.prisma, null);

      await request(testApp.app.getHttpServer())
        .get('/inscription/equipes/toutes')
        .set('Authorization', 'Bearer inconnu-1')
        .expect(401);

      expect(getEquipes.execute).not.toHaveBeenCalled();
    });

    it('returns 200 and lists all teams when the authenticated user has role ORGANISATEUR', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');
      getEquipes.execute.mockResolvedValue([
        { id: 1, nom: 'Equipe A', active: false },
      ]);

      const res = await request(testApp.app.getHttpServer())
        .get('/inscription/equipes/toutes')
        .set('Authorization', 'Bearer organisateur-1')
        .expect(200);

      expect(res.body).toEqual([{ id: 1, nom: 'Equipe A', active: false }]);
      expect(getEquipes.execute).toHaveBeenCalledWith(true);
    });
  });

  describe('POST /inscription/equipes', () => {
    const dto = { nom: 'Nouvelle Equipe' };

    it('returns 401 without authentication and does not call the use case', async () => {
      await request(testApp.app.getHttpServer())
        .post('/inscription/equipes')
        .send(dto)
        .expect(401);

      expect(createEquipe.execute).not.toHaveBeenCalled();
    });

    // Documente le comportement actuel (audit) : aucun @Roles sur cette route,
    // donc tout utilisateur authentifié peut créer une équipe référentiel,
    // quel que soit son rôle InscUtilisateur.
    it.each(['responsable-1', 'organisateur-1'] as const)(
      'returns 201 for any authenticated user (uid=%s), without checking InscUtilisateur role',
      async (uid) => {
        createEquipe.execute.mockResolvedValue({
          id: 1,
          ...dto,
          active: false,
        });

        const res = await request(testApp.app.getHttpServer())
          .post('/inscription/equipes')
          .set('Authorization', `Bearer ${uid}`)
          .send(dto)
          .expect(201);

        expect(res.body.id).toBe(1);
        expect(createEquipe.execute).toHaveBeenCalledWith(dto);
      },
    );

    // docs/specs/-prise-en-compte-du-nom-court-pour-les-logos-contexte-actuel.md — CA5, CA8
    it('passes nomComplet to the use case and returns it', async () => {
      const dtoAvecNomComplet = {
        nom: 'Courbevoie',
        nomComplet: 'Les Coqs de Courbevoie',
      };
      createEquipe.execute.mockResolvedValue({
        id: 7,
        ...dtoAvecNomComplet,
        active: true,
      });

      const res = await request(testApp.app.getHttpServer())
        .post('/inscription/equipes')
        .set('Authorization', 'Bearer organisateur-1')
        .send(dtoAvecNomComplet)
        .expect(201);

      expect(createEquipe.execute).toHaveBeenCalledWith(dtoAvecNomComplet);
      expect(res.body.nomComplet).toBe('Les Coqs de Courbevoie');
    });

    it('returns 409 with an explicit message when the team name already exists', async () => {
      createEquipe.execute.mockRejectedValue(
        new ConflictException('Cette équipe existe déjà'),
      );

      const res = await request(testApp.app.getHttpServer())
        .post('/inscription/equipes')
        .set('Authorization', 'Bearer organisateur-1')
        .send(dto)
        .expect(409);

      expect(res.body.message).toBe('Cette équipe existe déjà');
    });
  });

  describe('PATCH /inscription/equipes/:id/activer', () => {
    it('returns 401 without authentication and does not call the use case', async () => {
      await request(testApp.app.getHttpServer())
        .patch('/inscription/equipes/1/activer')
        .expect(401);

      expect(validateEquipe.activate).not.toHaveBeenCalled();
    });

    it('returns 403 when the authenticated user has role RESPONSABLE_EQUIPE', async () => {
      givenRole(testApp.prisma, 'RESPONSABLE_EQUIPE');

      await request(testApp.app.getHttpServer())
        .patch('/inscription/equipes/1/activer')
        .set('Authorization', 'Bearer responsable-1')
        .expect(403);

      expect(validateEquipe.activate).not.toHaveBeenCalled();
    });

    it('returns 200 and activates the team when the authenticated user has role ORGANISATEUR', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');
      validateEquipe.activate.mockResolvedValue({ id: 1, active: true });

      const res = await request(testApp.app.getHttpServer())
        .patch('/inscription/equipes/1/activer')
        .set('Authorization', 'Bearer organisateur-1')
        .expect(200);

      expect(res.body).toEqual({ id: 1, active: true });
      expect(validateEquipe.activate).toHaveBeenCalledWith(1);
    });
  });

  describe('PATCH /inscription/equipes/:id/desactiver', () => {
    it('returns 401 without authentication and does not call the use case', async () => {
      await request(testApp.app.getHttpServer())
        .patch('/inscription/equipes/1/desactiver')
        .expect(401);

      expect(validateEquipe.deactivate).not.toHaveBeenCalled();
    });

    it('returns 403 when the authenticated user has role RESPONSABLE_EQUIPE', async () => {
      givenRole(testApp.prisma, 'RESPONSABLE_EQUIPE');

      await request(testApp.app.getHttpServer())
        .patch('/inscription/equipes/1/desactiver')
        .set('Authorization', 'Bearer responsable-1')
        .expect(403);

      expect(validateEquipe.deactivate).not.toHaveBeenCalled();
    });

    it('returns 200 and deactivates the team when the authenticated user has role ORGANISATEUR', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');
      validateEquipe.deactivate.mockResolvedValue({ id: 1, active: false });

      const res = await request(testApp.app.getHttpServer())
        .patch('/inscription/equipes/1/desactiver')
        .set('Authorization', 'Bearer organisateur-1')
        .expect(200);

      expect(res.body).toEqual({ id: 1, active: false });
      expect(validateEquipe.deactivate).toHaveBeenCalledWith(1);
    });
  });

  // docs/specs/recommandations-finales-contexte-la-mise-en-place-de-la-colo.md — §6, CA1, CA7, CA10
  describe('PATCH /inscription/equipes/:id', () => {
    const corps = { nom: 'Courbevoie', nomComplet: 'Les Coqs de Courbevoie' };

    it('returns 401 without authentication and does not call the use case', async () => {
      await request(testApp.app.getHttpServer())
        .patch('/inscription/equipes/7')
        .send(corps)
        .expect(401);

      expect(updateEquipe.execute).not.toHaveBeenCalled();
    });

    it.each(['RESPONSABLE_EQUIPE', 'TABLE_DE_MARQUE'] as const)(
      'returns 403 when the authenticated user has role %s',
      async (role) => {
        givenRole(testApp.prisma, role);

        await request(testApp.app.getHttpServer())
          .patch('/inscription/equipes/7')
          .set('Authorization', 'Bearer autre-1')
          .send(corps)
          .expect(403);

        expect(updateEquipe.execute).not.toHaveBeenCalled();
      },
    );

    it('returns 401 when no InscUtilisateur matches the authenticated user', async () => {
      givenRole(testApp.prisma, null);

      await request(testApp.app.getHttpServer())
        .patch('/inscription/equipes/7')
        .set('Authorization', 'Bearer inconnu-1')
        .send(corps)
        .expect(401);

      expect(updateEquipe.execute).not.toHaveBeenCalled();
    });

    it('returns 200, passes the numeric id and the body to the use case, and returns the updated team', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');
      updateEquipe.execute.mockResolvedValue({
        id: 7,
        ...corps,
        active: true,
        nbCandidatures: 2,
      });

      const res = await request(testApp.app.getHttpServer())
        .patch('/inscription/equipes/7')
        .set('Authorization', 'Bearer organisateur-1')
        .send(corps)
        .expect(200);

      expect(updateEquipe.execute).toHaveBeenCalledWith(7, corps);
      expect(res.body).toEqual({ id: 7, ...corps, active: true, nbCandidatures: 2 });
    });

    it('passes nomComplet: null through (clearing the full name)', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');
      updateEquipe.execute.mockResolvedValue({ id: 7, nom: 'Courbevoie', nomComplet: null });

      await request(testApp.app.getHttpServer())
        .patch('/inscription/equipes/7')
        .set('Authorization', 'Bearer organisateur-1')
        .send({ nomComplet: null })
        .expect(200);

      expect(updateEquipe.execute).toHaveBeenCalledWith(7, { nomComplet: null });
    });

    it('returns 400 for a non-numeric id and does not call the use case', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');

      await request(testApp.app.getHttpServer())
        .patch('/inscription/equipes/abc')
        .set('Authorization', 'Bearer organisateur-1')
        .send(corps)
        .expect(400);

      expect(updateEquipe.execute).not.toHaveBeenCalled();
    });

    it('returns 409 with the lock message when a candidature references the team', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');
      updateEquipe.execute.mockRejectedValue(
        new ConflictException(
          'Le nom court ne peut plus être modifié : une candidature fait référence à cette équipe',
        ),
      );

      const res = await request(testApp.app.getHttpServer())
        .patch('/inscription/equipes/7')
        .set('Authorization', 'Bearer organisateur-1')
        .send({ nom: 'Rennes' })
        .expect(409);

      expect(res.body.message).toBe(
        'Le nom court ne peut plus être modifié : une candidature fait référence à cette équipe',
      );
    });

    it('returns 409 with the duplicate message when another team already has this name', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');
      updateEquipe.execute.mockRejectedValue(
        new ConflictException('Cette équipe existe déjà'),
      );

      const res = await request(testApp.app.getHttpServer())
        .patch('/inscription/equipes/7')
        .set('Authorization', 'Bearer organisateur-1')
        .send({ nom: 'Rennes' })
        .expect(409);

      expect(res.body.message).toBe('Cette équipe existe déjà');
    });

    it('returns 404 when the team does not exist', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');
      updateEquipe.execute.mockRejectedValue(
        new NotFoundException('Équipe référentiel 7 introuvable'),
      );

      await request(testApp.app.getHttpServer())
        .patch('/inscription/equipes/7')
        .set('Authorization', 'Bearer organisateur-1')
        .send(corps)
        .expect(404);
    });

    it('does not shadow the activer / desactiver routes', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');
      validateEquipe.activate.mockResolvedValue({ id: 7, active: true });
      validateEquipe.deactivate.mockResolvedValue({ id: 7, active: false });

      await request(testApp.app.getHttpServer())
        .patch('/inscription/equipes/7/activer')
        .set('Authorization', 'Bearer organisateur-1')
        .expect(200);
      await request(testApp.app.getHttpServer())
        .patch('/inscription/equipes/7/desactiver')
        .set('Authorization', 'Bearer organisateur-1')
        .expect(200);

      expect(updateEquipe.execute).not.toHaveBeenCalled();
      expect(validateEquipe.activate).toHaveBeenCalledWith(7);
      expect(validateEquipe.deactivate).toHaveBeenCalledWith(7);
    });
  });

  // CA10 — la route publique n'expose aucune information dérivée des candidatures.
  describe('nbCandidatures', () => {
    const equipe = {
      id: 1,
      nom: 'Courbevoie',
      nomComplet: null,
      logoUrl: null,
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      candidatureEnCours: true,
      nbCandidatures: 3,
    };

    it('is never exposed by the public route, even if the use case returns it', async () => {
      getEquipes.execute.mockResolvedValue([equipe]);

      const res = await request(testApp.app.getHttpServer())
        .get('/inscription/equipes')
        .expect(200);

      expect(res.body[0]).not.toHaveProperty('nbCandidatures');
      expect(res.body[0]).not.toHaveProperty('candidatureEnCours');
    });

    it('is exposed to the organiser by /toutes', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');
      getEquipes.execute.mockResolvedValue([equipe]);

      const res = await request(testApp.app.getHttpServer())
        .get('/inscription/equipes/toutes')
        .set('Authorization', 'Bearer organisateur-1')
        .expect(200);

      expect(res.body[0].nbCandidatures).toBe(3);
    });
  });
});
