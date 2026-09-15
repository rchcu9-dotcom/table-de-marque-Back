import request from 'supertest';
import { EquipeReferentielController } from '@/inscription/infrastructure/http/equipe-referentiel.controller';
import { GetEquipesReferentielUseCase } from '@/inscription/application/equipe/get-equipes-referentiel.usecase';
import { CreateEquipeReferentielUseCase } from '@/inscription/application/equipe/create-equipe-referentiel.usecase';
import { ValidateEquipeReferentielUseCase } from '@/inscription/application/equipe/validate-equipe-referentiel.usecase';
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

  beforeEach(async () => {
    getEquipes = { execute: jest.fn() };
    createEquipe = { execute: jest.fn() };
    validateEquipe = { activate: jest.fn(), deactivate: jest.fn() };

    testApp = await buildInscriptionTestApp(
      [EquipeReferentielController],
      [
        { provide: GetEquipesReferentielUseCase, useValue: getEquipes },
        { provide: CreateEquipeReferentielUseCase, useValue: createEquipe },
        {
          provide: ValidateEquipeReferentielUseCase,
          useValue: validateEquipe,
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
});
