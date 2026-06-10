import request from 'supertest';
import { EditionController } from '@/inscription/infrastructure/http/edition.controller';
import { GetEditionCouranteUseCase } from '@/inscription/application/edition/get-edition-courante.usecase';
import { CreateEditionUseCase } from '@/inscription/application/edition/create-edition.usecase';
import { UpdateEditionUseCase } from '@/inscription/application/edition/update-edition.usecase';
import {
  buildInscriptionTestApp,
  givenRole,
  type InscriptionTestApp,
} from './support/inscription-test-app';

describe('EditionController (integration)', () => {
  let testApp: InscriptionTestApp;
  let getEditionCourante: { execute: jest.Mock };
  let createEdition: { execute: jest.Mock };
  let updateEdition: { execute: jest.Mock };

  beforeEach(async () => {
    getEditionCourante = { execute: jest.fn() };
    createEdition = { execute: jest.fn() };
    updateEdition = { execute: jest.fn() };

    testApp = await buildInscriptionTestApp(
      [EditionController],
      [
        { provide: GetEditionCouranteUseCase, useValue: getEditionCourante },
        { provide: CreateEditionUseCase, useValue: createEdition },
        { provide: UpdateEditionUseCase, useValue: updateEdition },
      ],
    );
  });

  afterEach(async () => {
    await testApp.app.close();
  });

  describe('GET /inscription/edition/courante', () => {
    it('is publicly accessible and returns the use case result', async () => {
      getEditionCourante.execute.mockResolvedValue({
        id: 1,
        nom: 'Edition 2026',
      });

      const res = await request(testApp.app.getHttpServer())
        .get('/inscription/edition/courante')
        .expect(200);

      expect(res.body).toEqual({ id: 1, nom: 'Edition 2026' });
      expect(getEditionCourante.execute).toHaveBeenCalledTimes(1);
    });
  });

  const createDto = {
    nom: 'Edition 2026',
    categorie: 'U11',
    annee: 2026,
    dateDebut: '2026-09-01T00:00:00.000Z',
    dateFinDebut: '2026-09-01T00:00:00.000Z',
    dateFinFin: '2026-09-03T00:00:00.000Z',
    fraisInscription: 100,
    prixRepas: 10,
  };

  describe('POST /inscription/editions', () => {
    it('returns 401 without authentication and does not call the use case', async () => {
      await request(testApp.app.getHttpServer())
        .post('/inscription/editions')
        .send(createDto)
        .expect(401);

      expect(createEdition.execute).not.toHaveBeenCalled();
    });

    it('returns 403 when the authenticated user has role RESPONSABLE_EQUIPE', async () => {
      givenRole(testApp.prisma, 'RESPONSABLE_EQUIPE');

      await request(testApp.app.getHttpServer())
        .post('/inscription/editions')
        .set('Authorization', 'Bearer responsable-1')
        .send(createDto)
        .expect(403);

      expect(createEdition.execute).not.toHaveBeenCalled();
    });

    it('returns 403 when no InscUtilisateur matches the authenticated user', async () => {
      givenRole(testApp.prisma, null);

      await request(testApp.app.getHttpServer())
        .post('/inscription/editions')
        .set('Authorization', 'Bearer inconnu-1')
        .send(createDto)
        .expect(403);

      expect(createEdition.execute).not.toHaveBeenCalled();
    });

    it('returns 201 and calls the use case when the authenticated user has role ORGANISATEUR', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');
      createEdition.execute.mockResolvedValue({ id: 1, ...createDto });

      const res = await request(testApp.app.getHttpServer())
        .post('/inscription/editions')
        .set('Authorization', 'Bearer organisateur-1')
        .send(createDto)
        .expect(201);

      expect(res.body.id).toBe(1);
      expect(createEdition.execute).toHaveBeenCalledWith(createDto);
    });
  });

  describe('PATCH /inscription/editions/:id', () => {
    const updateDto = { nom: 'Edition 2026 (renommée)' };

    it('returns 401 without authentication and does not call the use case', async () => {
      await request(testApp.app.getHttpServer())
        .patch('/inscription/editions/1')
        .send(updateDto)
        .expect(401);

      expect(updateEdition.execute).not.toHaveBeenCalled();
    });

    it('returns 403 when the authenticated user has role RESPONSABLE_EQUIPE', async () => {
      givenRole(testApp.prisma, 'RESPONSABLE_EQUIPE');

      await request(testApp.app.getHttpServer())
        .patch('/inscription/editions/1')
        .set('Authorization', 'Bearer responsable-1')
        .send(updateDto)
        .expect(403);

      expect(updateEdition.execute).not.toHaveBeenCalled();
    });

    it('returns 403 when no InscUtilisateur matches the authenticated user', async () => {
      givenRole(testApp.prisma, null);

      await request(testApp.app.getHttpServer())
        .patch('/inscription/editions/1')
        .set('Authorization', 'Bearer inconnu-1')
        .send(updateDto)
        .expect(403);

      expect(updateEdition.execute).not.toHaveBeenCalled();
    });

    it('returns 200 and calls the use case when the authenticated user has role ORGANISATEUR', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');
      updateEdition.execute.mockResolvedValue({ id: 1, ...updateDto });

      const res = await request(testApp.app.getHttpServer())
        .patch('/inscription/editions/1')
        .set('Authorization', 'Bearer organisateur-1')
        .send(updateDto)
        .expect(200);

      expect(res.body.id).toBe(1);
      expect(updateEdition.execute).toHaveBeenCalledWith(1, updateDto);
    });
  });
});
