import { EditionController } from './edition.controller';
import { ROLES_KEY } from '../../../auth/decorators/roles.decorator';
import type { GetEditionCouranteUseCase } from '../../application/edition/get-edition-courante.usecase';
import type { GetEditionEnPreparationUseCase } from '../../application/edition/get-edition-en-preparation.usecase';
import type { CreateEditionUseCase } from '../../application/edition/create-edition.usecase';
import type { UpdateEditionUseCase } from '../../application/edition/update-edition.usecase';
import type { DemarrerTournoiUseCase } from '../../application/edition/demarrer-tournoi.usecase';
import type { ExportTaUseCase } from '../../application/edition/export-ta.usecase';

/**
 * Tests unitaires (sans HTTP réel) : le harnais d'intégration partagé
 * (test/inscription/support/inscription-test-app.ts) référence encore
 * FirebaseAuthGuard/InscriptionRoleGuard, une architecture d'auth remplacée
 * depuis par l'AuthGuard global unique (@Roles + APP_GUARD) — ces fichiers
 * n'existent plus et le harnais ne compile plus (pré-existant, indépendant
 * de cette feature, cf. decisions.json). Ces tests couvrent donc à la place,
 * au niveau du contrôleur directement : la délégation vers les use cases et
 * la présence du garde-fou de rôle déclaratif sur chaque route.
 */
describe('EditionController', () => {
  function makeController() {
    const getEditionCourante = { execute: jest.fn() } as unknown as GetEditionCouranteUseCase;
    const getEditionEnPreparation = {
      execute: jest.fn(),
    } as unknown as GetEditionEnPreparationUseCase;
    const createEdition = { execute: jest.fn() } as unknown as CreateEditionUseCase;
    const updateEdition = { execute: jest.fn() } as unknown as UpdateEditionUseCase;
    const demarrerTournoi = { execute: jest.fn() } as unknown as DemarrerTournoiUseCase;
    const exportTa = { execute: jest.fn() } as unknown as ExportTaUseCase;
    const controller = new EditionController(
      getEditionCourante,
      getEditionEnPreparation,
      createEdition,
      updateEdition,
      demarrerTournoi,
      exportTa,
    );
    return {
      controller,
      getEditionCourante,
      getEditionEnPreparation,
      createEdition,
      updateEdition,
      demarrerTournoi,
      exportTa,
    };
  }

  function makeRes() {
    return { set: jest.fn() } as unknown as import('express').Response;
  }

  describe('courante()', () => {
    it("n'exige aucun rôle (route publique)", () => {
      const roles = Reflect.getMetadata(ROLES_KEY, EditionController.prototype.courante);
      expect(roles).toBeUndefined();
    });

    it('délègue à GetEditionCouranteUseCase.execute et retourne son résultat', async () => {
      const { controller, getEditionCourante } = makeController();
      (getEditionCourante.execute as jest.Mock).mockResolvedValue({ id: 1 });

      const result = await controller.courante();

      expect(getEditionCourante.execute).toHaveBeenCalledWith();
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('enPreparation()', () => {
    it('exige le rôle ORGANISATEUR (métadonnée @Roles posée sur la route)', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, EditionController.prototype.enPreparation);
      expect(roles).toEqual(['ORGANISATEUR']);
    });

    it('délègue à GetEditionEnPreparationUseCase.execute et retourne null quand aucune édition en préparation', async () => {
      const { controller, getEditionEnPreparation } = makeController();
      (getEditionEnPreparation.execute as jest.Mock).mockResolvedValue(null);

      const result = await controller.enPreparation();

      expect(getEditionEnPreparation.execute).toHaveBeenCalledWith();
      expect(result).toBeNull();
    });

    it('retourne l\'édition en préparation quand elle existe', async () => {
      const { controller, getEditionEnPreparation } = makeController();
      (getEditionEnPreparation.execute as jest.Mock).mockResolvedValue({
        id: 2,
        etape: 'CREATION_NOUVEAU_TOURNOI',
      });

      const result = await controller.enPreparation();

      expect(result).toEqual({ id: 2, etape: 'CREATION_NOUVEAU_TOURNOI' });
    });
  });

  describe('create()', () => {
    it('exige le rôle ORGANISATEUR (métadonnée @Roles posée sur la route)', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, EditionController.prototype.create);
      expect(roles).toEqual(['ORGANISATEUR']);
    });

    it('délègue à CreateEditionUseCase.execute avec le dto', async () => {
      const { controller, createEdition } = makeController();
      (createEdition.execute as jest.Mock).mockResolvedValue({ id: 3 });

      const result = await controller.create({ nom: 'X' } as never);

      expect(createEdition.execute).toHaveBeenCalledWith({ nom: 'X' });
      expect(result).toEqual({ id: 3 });
    });
  });

  describe('demarrer()', () => {
    it("exige le rôle ORGANISATEUR (métadonnée @Roles posée sur la route)", () => {
      const roles = Reflect.getMetadata(ROLES_KEY, EditionController.prototype.demarrer);
      expect(roles).toEqual(['ORGANISATEUR']);
    });

    it('délègue à DemarrerTournoiUseCase.execute avec l\'id parsé et retourne son résultat', async () => {
      const { controller, demarrerTournoi } = makeController();
      (demarrerTournoi.execute as jest.Mock).mockResolvedValue({
        id: 1,
        etape: 'TOURNOI_DEMARRE',
      });

      const result = await controller.demarrer(1);

      expect(demarrerTournoi.execute).toHaveBeenCalledWith(1);
      expect(result).toEqual({ id: 1, etape: 'TOURNOI_DEMARRE' });
    });
  });

  describe('update()', () => {
    it("exige le rôle ORGANISATEUR (métadonnée @Roles posée sur la route)", () => {
      const roles = Reflect.getMetadata(ROLES_KEY, EditionController.prototype.update);
      expect(roles).toEqual(['ORGANISATEUR']);
    });

    it('délègue à UpdateEditionUseCase.execute avec id + dto', async () => {
      const { controller, updateEdition } = makeController();
      (updateEdition.execute as jest.Mock).mockResolvedValue({ id: 1, nom: 'X' });

      const result = await controller.update(1, { nom: 'X' } as never);

      expect(updateEdition.execute).toHaveBeenCalledWith(1, { nom: 'X' });
      expect(result).toEqual({ id: 1, nom: 'X' });
    });
  });

  describe('exportTaTables()', () => {
    it('exige le rôle ORGANISATEUR (métadonnée @Roles posée sur la route)', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, EditionController.prototype.exportTaTables);
      expect(roles).toEqual(['ORGANISATEUR']);
    });

    it("délègue à ExportTaUseCase.execute avec l'id parsé, pose Content-Type/Content-Disposition et retourne le payload", async () => {
      const { controller, exportTa } = makeController();
      (exportTa.execute as jest.Mock).mockResolvedValue({
        filename: 'dump-ta-2026-rchc-u11.json',
        payload: { TA_MATCHS: [] },
      });
      const res = makeRes();

      const result = await controller.exportTaTables(1, res);

      expect(exportTa.execute).toHaveBeenCalledWith(1);
      expect(res.set).toHaveBeenCalledWith({
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="dump-ta-2026-rchc-u11.json"',
      });
      expect(result).toEqual({ TA_MATCHS: [] });
    });
  });
});
