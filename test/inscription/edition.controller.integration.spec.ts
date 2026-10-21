import request from 'supertest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EditionController } from '@/inscription/infrastructure/http/edition.controller';
import { GetEditionCouranteUseCase } from '@/inscription/application/edition/get-edition-courante.usecase';
import { GetEditionEnPreparationUseCase } from '@/inscription/application/edition/get-edition-en-preparation.usecase';
import { CreateEditionUseCase } from '@/inscription/application/edition/create-edition.usecase';
import { UpdateEditionUseCase } from '@/inscription/application/edition/update-edition.usecase';
import { DemarrerTournoiUseCase } from '@/inscription/application/edition/demarrer-tournoi.usecase';
import { OuvrirInscriptionsUseCase } from '@/inscription/application/edition/ouvrir-inscriptions.usecase';
import { CloturerInscriptionsUseCase } from '@/inscription/application/edition/cloturer-inscriptions.usecase';
import { RevenirEnPreparationUseCase } from '@/inscription/application/edition/revenir-en-preparation.usecase';
import {
  MESSAGE_INSCRIPTION_FIGEE,
  MESSAGE_RETOUR_AVEC_CANDIDATURES,
} from '@/inscription/domain/edition-regles';
import { ExportTaUseCase } from '@/inscription/application/edition/export-ta.usecase';
import { AjouterAnneeAgeUseCase } from '@/inscription/application/edition/ajouter-annee-age.usecase';
import { RetirerAnneeAgeUseCase } from '@/inscription/application/edition/retirer-annee-age.usecase';
import { UploadImageRibUseCase } from '@/inscription/application/edition/upload-image-rib.usecase';
import { GetImageRibUseCase } from '@/inscription/application/edition/get-image-rib.usecase';
import { DeleteImageRibUseCase } from '@/inscription/application/edition/delete-image-rib.usecase';
import {
  buildInscriptionTestApp,
  givenRole,
  type InscriptionTestApp,
} from './support/inscription-test-app';

describe('EditionController (integration)', () => {
  let testApp: InscriptionTestApp;
  let getEditionCourante: { execute: jest.Mock };
  let getEditionEnPreparation: { execute: jest.Mock };
  let createEdition: { execute: jest.Mock };
  let updateEdition: { execute: jest.Mock };
  let demarrerTournoi: { execute: jest.Mock };
  let ouvrirInscriptions: { execute: jest.Mock };
  let cloturerInscriptions: { execute: jest.Mock };
  let revenirEnPreparation: { execute: jest.Mock };
  let exportTa: { execute: jest.Mock };
  let ajouterAnneeAge: { execute: jest.Mock };
  let retirerAnneeAge: { execute: jest.Mock };
  let uploadImageRib: { execute: jest.Mock };
  let getImageRib: { execute: jest.Mock };
  let deleteImageRib: { execute: jest.Mock };

  beforeEach(async () => {
    getEditionCourante = { execute: jest.fn() };
    getEditionEnPreparation = { execute: jest.fn() };
    createEdition = { execute: jest.fn() };
    updateEdition = { execute: jest.fn() };
    demarrerTournoi = { execute: jest.fn() };
    ouvrirInscriptions = { execute: jest.fn() };
    cloturerInscriptions = { execute: jest.fn() };
    revenirEnPreparation = { execute: jest.fn() };
    exportTa = { execute: jest.fn() };
    ajouterAnneeAge = { execute: jest.fn() };
    retirerAnneeAge = { execute: jest.fn() };
    uploadImageRib = { execute: jest.fn() };
    getImageRib = { execute: jest.fn() };
    deleteImageRib = { execute: jest.fn() };

    testApp = await buildInscriptionTestApp(
      [EditionController],
      [
        { provide: GetEditionCouranteUseCase, useValue: getEditionCourante },
        {
          provide: GetEditionEnPreparationUseCase,
          useValue: getEditionEnPreparation,
        },
        { provide: CreateEditionUseCase, useValue: createEdition },
        { provide: UpdateEditionUseCase, useValue: updateEdition },
        { provide: DemarrerTournoiUseCase, useValue: demarrerTournoi },
        { provide: OuvrirInscriptionsUseCase, useValue: ouvrirInscriptions },
        { provide: CloturerInscriptionsUseCase, useValue: cloturerInscriptions },
        { provide: RevenirEnPreparationUseCase, useValue: revenirEnPreparation },
        { provide: ExportTaUseCase, useValue: exportTa },
        { provide: AjouterAnneeAgeUseCase, useValue: ajouterAnneeAge },
        { provide: RetirerAnneeAgeUseCase, useValue: retirerAnneeAge },
        { provide: UploadImageRibUseCase, useValue: uploadImageRib },
        { provide: GetImageRibUseCase, useValue: getImageRib },
        { provide: DeleteImageRibUseCase, useValue: deleteImageRib },
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

    it('returns 401 when no InscUtilisateur matches the authenticated user', async () => {
      givenRole(testApp.prisma, null);

      await request(testApp.app.getHttpServer())
        .post('/inscription/editions')
        .set('Authorization', 'Bearer inconnu-1')
        .send(createDto)
        .expect(401);

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

    it('returns 401 when no InscUtilisateur matches the authenticated user', async () => {
      givenRole(testApp.prisma, null);

      await request(testApp.app.getHttpServer())
        .patch('/inscription/editions/1')
        .set('Authorization', 'Bearer inconnu-1')
        .send(updateDto)
        .expect(401);

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

  describe('POST /inscription/editions/:id/demarrer-tournoi', () => {
    it('returns 401 without authentication and does not call the use case', async () => {
      await request(testApp.app.getHttpServer())
        .post('/inscription/editions/1/demarrer-tournoi')
        .expect(401);

      expect(demarrerTournoi.execute).not.toHaveBeenCalled();
    });

    it('returns 403 when the authenticated user has role RESPONSABLE_EQUIPE', async () => {
      givenRole(testApp.prisma, 'RESPONSABLE_EQUIPE');

      await request(testApp.app.getHttpServer())
        .post('/inscription/editions/1/demarrer-tournoi')
        .set('Authorization', 'Bearer responsable-1')
        .expect(403);

      expect(demarrerTournoi.execute).not.toHaveBeenCalled();
    });

    it('returns 401 when no InscUtilisateur matches the authenticated user', async () => {
      givenRole(testApp.prisma, null);

      await request(testApp.app.getHttpServer())
        .post('/inscription/editions/1/demarrer-tournoi')
        .set('Authorization', 'Bearer inconnu-1')
        .expect(401);

      expect(demarrerTournoi.execute).not.toHaveBeenCalled();
    });

    it('returns 201 and calls the use case when the authenticated user has role ORGANISATEUR', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');
      demarrerTournoi.execute.mockResolvedValue({
        id: 1,
        etape: 'TOURNOI_DEMARRE',
      });

      const res = await request(testApp.app.getHttpServer())
        .post('/inscription/editions/1/demarrer-tournoi')
        .set('Authorization', 'Bearer organisateur-1')
        .expect(201);

      expect(res.body).toEqual({ id: 1, etape: 'TOURNOI_DEMARRE' });
      expect(demarrerTournoi.execute).toHaveBeenCalledWith(1);
    });

    it('propagates a 400 when the use case rejects the transition (edition not CLOTUREE)', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');
      demarrerTournoi.execute.mockRejectedValue(
        new BadRequestException(
          "Le tournoi ne peut être démarré que depuis l'étape CLOTUREE.",
        ),
      );

      await request(testApp.app.getHttpServer())
        .post('/inscription/editions/1/demarrer-tournoi')
        .set('Authorization', 'Bearer organisateur-1')
        .expect(400);
    });
  });

  describe.each([
    ['ouvrir-inscriptions', () => ouvrirInscriptions, 'INSCRIPTIONS_OUVERTES'],
    ['cloturer-inscriptions', () => cloturerInscriptions, 'CLOTUREE'],
    ['revenir-en-preparation', () => revenirEnPreparation, 'CREEE'],
  ] as const)('POST /inscription/editions/:id/%s', (route, useCase, etape) => {
    const url = `/inscription/editions/1/${route}`;

    it('returns 401 without authentication and does not call the use case', async () => {
      await request(testApp.app.getHttpServer()).post(url).expect(401);

      expect(useCase().execute).not.toHaveBeenCalled();
    });

    it('returns 403 when the authenticated user has role RESPONSABLE_EQUIPE', async () => {
      givenRole(testApp.prisma, 'RESPONSABLE_EQUIPE');

      await request(testApp.app.getHttpServer())
        .post(url)
        .set('Authorization', 'Bearer responsable-1')
        .expect(403);

      expect(useCase().execute).not.toHaveBeenCalled();
    });

    it('returns 401 when no InscUtilisateur matches the authenticated user', async () => {
      givenRole(testApp.prisma, null);

      await request(testApp.app.getHttpServer())
        .post(url)
        .set('Authorization', 'Bearer inconnu-1')
        .expect(401);

      expect(useCase().execute).not.toHaveBeenCalled();
    });

    it('returns 201 and calls the use case when the authenticated user has role ORGANISATEUR', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');
      useCase().execute.mockResolvedValue({ id: 1, etape });

      const res = await request(testApp.app.getHttpServer())
        .post(url)
        .set('Authorization', 'Bearer organisateur-1')
        .expect(201);

      expect(res.body).toEqual({ id: 1, etape });
      expect(useCase().execute).toHaveBeenCalledWith(1);
    });

    it('propagates a 409 when the transition is not allowed', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');
      useCase().execute.mockRejectedValue(
        new ConflictException("Transition d'étape interdite : X → Y"),
      );

      const res = await request(testApp.app.getHttpServer())
        .post(url)
        .set('Authorization', 'Bearer organisateur-1')
        .expect(409);

      expect(res.body.message).toBe("Transition d'étape interdite : X → Y");
    });

    it('propagates a 404 when the edition does not exist', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');
      useCase().execute.mockRejectedValue(new NotFoundException('Édition 1 introuvable'));

      await request(testApp.app.getHttpServer())
        .post(url)
        .set('Authorization', 'Bearer organisateur-1')
        .expect(404);
    });
  });

  it('POST revenir-en-preparation propage le 409 « candidatures existantes » avec son message', async () => {
    givenRole(testApp.prisma, 'ORGANISATEUR');
    revenirEnPreparation.execute.mockRejectedValue(
      new ConflictException(MESSAGE_RETOUR_AVEC_CANDIDATURES),
    );

    const res = await request(testApp.app.getHttpServer())
      .post('/inscription/editions/1/revenir-en-preparation')
      .set('Authorization', 'Bearer organisateur-1')
      .expect(409);

    expect(res.body.message).toBe(MESSAGE_RETOUR_AVEC_CANDIDATURES);
  });

  // Paramètres d'inscription figés : chaque route d'écriture propage le 409 du
  // garde d'étape (porté par les use cases) avec son message explicite.
  describe.each([
    ['PATCH', '/inscription/editions/1', () => updateEdition, { nom: 'X' }],
    ['POST', '/inscription/editions/1/annees-age', () => ajouterAnneeAge, { annee: 2015 }],
    ['DELETE', '/inscription/editions/1/annees-age/2015', () => retirerAnneeAge, undefined],
    ['DELETE', '/inscription/editions/1/image-rib', () => deleteImageRib, undefined],
  ] as const)("%s %s — paramètres d'inscription figés", (methode, url, useCase, body) => {
    it('renvoie 409 avec le message du garde', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');
      useCase().execute.mockRejectedValue(new ConflictException(MESSAGE_INSCRIPTION_FIGEE));

      const server = request(testApp.app.getHttpServer());
      const req =
        methode === 'PATCH'
          ? server.patch(url)
          : methode === 'POST'
            ? server.post(url)
            : server.delete(url);
      const res = await req
        .set('Authorization', 'Bearer organisateur-1')
        .send(body as object | undefined)
        .expect(409);

      expect(res.body.message).toBe(MESSAGE_INSCRIPTION_FIGEE);
    });
  });

  describe('POST /inscription/editions/:id/image-rib (ORGANISATEUR only)', () => {
    it('returns 401 without authentication and does not call the use case', async () => {
      await request(testApp.app.getHttpServer())
        .post('/inscription/editions/1/image-rib')
        .attach('file', Buffer.from('fake-png-bytes'), 'rib.png')
        .expect(401);

      expect(uploadImageRib.execute).not.toHaveBeenCalled();
    });

    it('returns 403 when the authenticated user has role RESPONSABLE_EQUIPE', async () => {
      givenRole(testApp.prisma, 'RESPONSABLE_EQUIPE');

      await request(testApp.app.getHttpServer())
        .post('/inscription/editions/1/image-rib')
        .set('Authorization', 'Bearer responsable-1')
        .attach('file', Buffer.from('fake-png-bytes'), 'rib.png')
        .expect(403);

      expect(uploadImageRib.execute).not.toHaveBeenCalled();
    });

    it('returns 201 and calls the use case with the uploaded file for ORGANISATEUR (AC2)', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');
      uploadImageRib.execute.mockResolvedValue({
        id: 1,
        hasImageRib: true,
      });

      const res = await request(testApp.app.getHttpServer())
        .post('/inscription/editions/1/image-rib')
        .set('Authorization', 'Bearer organisateur-1')
        .attach('file', Buffer.from('fake-png-bytes'), 'rib.png')
        .expect(201);

      expect(res.body).toEqual({ id: 1, hasImageRib: true });
      expect(uploadImageRib.execute).toHaveBeenCalledTimes(1);
      const [editionId, file] = uploadImageRib.execute.mock.calls[0];
      expect(editionId).toBe(1);
      expect(file.mimetype).toBe('image/png');
      expect(file.originalname).toBe('rib.png');
    });

    it('propagates a 400 when the use case rejects an unauthorized MIME type (AC3)', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');
      uploadImageRib.execute.mockRejectedValue(
        new BadRequestException('Type de fichier non autorisé'),
      );

      await request(testApp.app.getHttpServer())
        .post('/inscription/editions/1/image-rib')
        .set('Authorization', 'Bearer organisateur-1')
        .attach('file', Buffer.from('fake-pdf-bytes'), 'rib.pdf')
        .expect(400);
    });

    it('rejects an oversized file before reaching the use case (AC3 — enforced at the interceptor layer)', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');
      const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024, 1);

      const res = await request(testApp.app.getHttpServer())
        .post('/inscription/editions/1/image-rib')
        .set('Authorization', 'Bearer organisateur-1')
        .attach('file', oversizedBuffer, 'rib.png');

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(uploadImageRib.execute).not.toHaveBeenCalled();
    });
  });

  describe('GET /inscription/editions/:id/image-rib (authenticated)', () => {
    it('returns 401 without authentication and does not call the use case', async () => {
      await request(testApp.app.getHttpServer())
        .get('/inscription/editions/1/image-rib')
        .expect(401);

      expect(getImageRib.execute).not.toHaveBeenCalled();
    });

    it('returns the binary with the right Content-Type and a private cache policy (AC8)', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');
      getImageRib.execute.mockResolvedValue({
        data: Buffer.from('fake-png-bytes'),
        mimeType: 'image/png',
      });

      const res = await request(testApp.app.getHttpServer())
        .get('/inscription/editions/1/image-rib')
        .set('Authorization', 'Bearer organisateur-1')
        .expect(200);

      expect(res.headers['content-type']).toContain('image/png');
      expect(res.headers['cache-control']).toBe('private, no-store');
      expect(res.body).toEqual(Buffer.from('fake-png-bytes'));
      expect(getImageRib.execute).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ role: 'ORGANISATEUR' }),
      );
    });

    it('returns 403 when the use case denies access (no candidature awaiting payment)', async () => {
      getImageRib.execute.mockRejectedValue(
        new ForbiddenException("Accès à l'image RIB non autorisé"),
      );

      await request(testApp.app.getHttpServer())
        .get('/inscription/editions/1/image-rib')
        .set('Authorization', 'Bearer responsable-1')
        .expect(403);
    });

    it('returns 404 when the use case reports no image (AC5/AC6/AC8)', async () => {
      getImageRib.execute.mockRejectedValue(
        new NotFoundException('Aucune image RIB enregistrée'),
      );

      await request(testApp.app.getHttpServer())
        .get('/inscription/editions/1/image-rib')
        .set('Authorization', 'Bearer responsable-1')
        .expect(404);
    });
  });

  describe('DELETE /inscription/editions/:id/image-rib (ORGANISATEUR only)', () => {
    it('returns 401 without authentication and does not call the use case', async () => {
      await request(testApp.app.getHttpServer())
        .delete('/inscription/editions/1/image-rib')
        .expect(401);

      expect(deleteImageRib.execute).not.toHaveBeenCalled();
    });

    it('returns 403 when the authenticated user has role RESPONSABLE_EQUIPE', async () => {
      givenRole(testApp.prisma, 'RESPONSABLE_EQUIPE');

      await request(testApp.app.getHttpServer())
        .delete('/inscription/editions/1/image-rib')
        .set('Authorization', 'Bearer responsable-1')
        .expect(403);

      expect(deleteImageRib.execute).not.toHaveBeenCalled();
    });

    it('returns 200 and calls the use case for ORGANISATEUR (AC6)', async () => {
      givenRole(testApp.prisma, 'ORGANISATEUR');
      deleteImageRib.execute.mockResolvedValue({ id: 1, hasImageRib: false });

      const res = await request(testApp.app.getHttpServer())
        .delete('/inscription/editions/1/image-rib')
        .set('Authorization', 'Bearer organisateur-1')
        .expect(200);

      expect(res.body).toEqual({ id: 1, hasImageRib: false });
      expect(deleteImageRib.execute).toHaveBeenCalledWith(1);
    });
  });
});
