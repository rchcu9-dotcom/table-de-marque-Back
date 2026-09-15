import { PresentationController } from '@/infrastructure/http/presentation/presentation.controller';
import { GetPresentationUseCase } from '@/application/presentation/use-cases/get-presentation.usecase';
import { ListPresentationArticlesUseCase } from '@/application/presentation/use-cases/list-presentation-articles.usecase';
import { CreerPresentationArticleUseCase } from '@/application/presentation/use-cases/creer-presentation-article.usecase';
import { ModifierPresentationArticleUseCase } from '@/application/presentation/use-cases/modifier-presentation-article.usecase';
import { SupprimerPresentationArticleUseCase } from '@/application/presentation/use-cases/supprimer-presentation-article.usecase';
import { ModifierPresentationGroupeUseCase } from '@/application/presentation/use-cases/modifier-presentation-groupe.usecase';
import { DeplacerPresentationGroupeUseCase } from '@/application/presentation/use-cases/deplacer-presentation-groupe.usecase';
import { DeplacerPresentationArticleUseCase } from '@/application/presentation/use-cases/deplacer-presentation-article.usecase';
import { SupprimerPresentationGroupeUseCase } from '@/application/presentation/use-cases/supprimer-presentation-groupe.usecase';
import { CacheSnapshotService } from '@/infrastructure/cache/cache.snapshot.service';
import { DriveImageProxyService } from '@/infrastructure/http/presentation/drive-image-proxy.service';
import { PresentationGroupe } from '@/domain/presentation/entities/article-presentation.entity';
import { PresentationArticleRecord } from '@/domain/presentation/repositories/presentation-article.repository';
import { UpsertPresentationArticleDto } from '@/application/presentation/dto/upsert-presentation-article.dto';
import { UpdatePresentationGroupeDto } from '@/application/presentation/dto/update-presentation-groupe.dto';
import { DeplacerDirectionDto } from '@/application/presentation/dto/deplacer-direction.dto';

function buildController({
  getExecute = jest.fn().mockResolvedValue([] as PresentationGroupe[]),
  listExecute = jest.fn().mockResolvedValue([] as PresentationArticleRecord[]),
  creerExecute = jest.fn(),
  modifierExecute = jest.fn(),
  supprimerExecute = jest.fn().mockResolvedValue(undefined),
  modifierGroupeExecute = jest.fn().mockResolvedValue(undefined),
  deplacerGroupeExecute = jest.fn().mockResolvedValue(undefined),
  deplacerArticleExecute = jest.fn().mockResolvedValue(undefined),
  supprimerGroupeExecute = jest.fn().mockResolvedValue(undefined),
  readThrough = jest
    .fn()
    .mockImplementation((_key: string, loader: () => Promise<unknown>) => loader()),
  setEntry = jest.fn(),
  imageFetch = jest.fn().mockResolvedValue(null),
}: {
  getExecute?: jest.Mock;
  listExecute?: jest.Mock;
  creerExecute?: jest.Mock;
  modifierExecute?: jest.Mock;
  supprimerExecute?: jest.Mock;
  modifierGroupeExecute?: jest.Mock;
  deplacerGroupeExecute?: jest.Mock;
  deplacerArticleExecute?: jest.Mock;
  supprimerGroupeExecute?: jest.Mock;
  readThrough?: jest.Mock;
  setEntry?: jest.Mock;
  imageFetch?: jest.Mock;
} = {}) {
  const getPresentation = { execute: getExecute } as unknown as GetPresentationUseCase;
  const listArticles = { execute: listExecute } as unknown as ListPresentationArticlesUseCase;
  const creerArticle = { execute: creerExecute } as unknown as CreerPresentationArticleUseCase;
  const modifierArticle = { execute: modifierExecute } as unknown as ModifierPresentationArticleUseCase;
  const supprimerArticle = { execute: supprimerExecute } as unknown as SupprimerPresentationArticleUseCase;
  const modifierGroupe = { execute: modifierGroupeExecute } as unknown as ModifierPresentationGroupeUseCase;
  const deplacerGroupe = { execute: deplacerGroupeExecute } as unknown as DeplacerPresentationGroupeUseCase;
  const deplacerArticle = { execute: deplacerArticleExecute } as unknown as DeplacerPresentationArticleUseCase;
  const supprimerGroupe = { execute: supprimerGroupeExecute } as unknown as SupprimerPresentationGroupeUseCase;
  const cache = { readThrough, setEntry } as unknown as CacheSnapshotService;
  const driveImageProxy = { fetch: imageFetch } as unknown as DriveImageProxyService;

  const controller = new PresentationController(
    getPresentation,
    listArticles,
    creerArticle,
    modifierArticle,
    supprimerArticle,
    modifierGroupe,
    deplacerGroupe,
    deplacerArticle,
    supprimerGroupe,
    cache,
    driveImageProxy,
  );

  return {
    controller,
    getExecute,
    listExecute,
    creerExecute,
    modifierExecute,
    supprimerExecute,
    modifierGroupeExecute,
    deplacerGroupeExecute,
    deplacerArticleExecute,
    supprimerGroupeExecute,
    readThrough,
    setEntry,
    imageFetch,
  };
}

function makeMockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
}

const dto: UpsertPresentationArticleDto = {
  groupe: 'Présentation',
  groupeEn: 'Presentation',
  titre: 'Résumé',
  titreEn: 'Summary',
  description: 'desc',
  descriptionEn: 'desc en',
  imageUrl: null,
  lienUrl: null,
  lieu: null,
  mapsQuery: null,
  ordre: 0,
};

const makeArticleRecord = (overrides: Partial<{
  id: number;
  groupe: string;
  groupeEn: string;
  titre: string;
  titreEn: string;
  description: string;
  descriptionEn: string;
  imageUrl: string | null;
  lienUrl: string | null;
  lieu: string | null;
  mapsQuery: string | null;
  ordre: number;
  groupeOrdre: number;
  groupeDureeMs: number;
  groupeImageUrl: string | null;
}> = {}) =>
  new PresentationArticleRecord(
    overrides.id ?? 1,
    overrides.groupe ?? dto.groupe,
    overrides.groupeEn ?? dto.groupeEn,
    overrides.titre ?? dto.titre,
    overrides.titreEn ?? dto.titreEn,
    overrides.description ?? dto.description,
    overrides.descriptionEn ?? dto.descriptionEn,
    overrides.imageUrl ?? null,
    overrides.lienUrl ?? null,
    overrides.lieu ?? null,
    overrides.mapsQuery ?? null,
    overrides.ordre ?? 0,
    overrides.groupeOrdre ?? 0,
    overrides.groupeDureeMs ?? 5000,
    overrides.groupeImageUrl ?? null,
  );

describe('PresentationController', () => {
  describe('GET / (public, cached)', () => {
    it('reads through the SWR cache under the "presentation" key and returns its result', async () => {
      const groupes: PresentationGroupe[] = [
        new PresentationGroupe('Presentation', 'Presentation', [], 0, 5000, null),
      ];
      const { controller, getExecute, readThrough } = buildController({
        getExecute: jest.fn().mockResolvedValue(groupes),
      });

      const result = await controller.findAll();

      expect(readThrough).toHaveBeenCalledWith('presentation', expect.any(Function));
      expect(getExecute).toHaveBeenCalledTimes(1);
      expect(result).toBe(groupes);
    });

    it('does not call the use case directly when the cache serves a cached value', async () => {
      const cachedResult: PresentationGroupe[] = [
        new PresentationGroupe('Cached', 'Cached', [], 0, 5000, null),
      ];
      const { controller, getExecute } = buildController({
        readThrough: jest.fn().mockResolvedValue(cachedResult),
      });

      const result = await controller.findAll();

      expect(result).toBe(cachedResult);
      expect(getExecute).not.toHaveBeenCalled();
    });
  });

  describe('GET /articles (admin, uncached)', () => {
    it('returns the raw ordered article list without going through the cache', async () => {
      const articles = [makeArticleRecord()];
      const { controller, listExecute, readThrough } = buildController({
        listExecute: jest.fn().mockResolvedValue(articles),
      });

      const result = await controller.articles();

      expect(result).toBe(articles);
      expect(readThrough).not.toHaveBeenCalled();
    });
  });

  describe('POST/PUT/DELETE /articles (admin writes)', () => {
    it('creates an article and republishes the cache with the fresh grouped view', async () => {
      const created = makeArticleRecord();
      const freshGroupes: PresentationGroupe[] = [
        new PresentationGroupe(dto.groupe, dto.groupeEn, [], 0, 5000, null),
      ];
      const { controller, creerExecute, getExecute, setEntry } = buildController({
        creerExecute: jest.fn().mockResolvedValue(created),
        getExecute: jest.fn().mockResolvedValue(freshGroupes),
      });

      const result = await controller.creer(dto);

      expect(result).toBe(created);
      expect(creerExecute).toHaveBeenCalledWith(dto);
      expect(getExecute).toHaveBeenCalledTimes(1);
      expect(setEntry).toHaveBeenCalledWith('presentation', freshGroupes);
    });

    it('updates an article and republishes the cache', async () => {
      const updated = makeArticleRecord();
      const { controller, modifierExecute, setEntry } = buildController({
        modifierExecute: jest.fn().mockResolvedValue(updated),
      });

      const result = await controller.modifier(1, dto);

      expect(result).toBe(updated);
      expect(modifierExecute).toHaveBeenCalledWith(1, dto);
      expect(setEntry).toHaveBeenCalledTimes(1);
    });

    it('deletes an article and republishes the cache', async () => {
      const { controller, supprimerExecute, setEntry } = buildController();

      await controller.supprimer(1);

      expect(supprimerExecute).toHaveBeenCalledWith(1);
      expect(setEntry).toHaveBeenCalledTimes(1);
    });
  });

  describe('PATCH /articles/:id/deplacer', () => {
    it('moves an article and republishes the cache', async () => {
      const direction: DeplacerDirectionDto = { direction: 'haut' };
      const { controller, deplacerArticleExecute, setEntry } = buildController();

      await controller.deplacerUnArticle(1, direction);

      expect(deplacerArticleExecute).toHaveBeenCalledWith(1, direction);
      expect(setEntry).toHaveBeenCalledTimes(1);
    });
  });

  describe('PATCH /groupes/:groupe', () => {
    it('updates the group meta and republishes the cache', async () => {
      const payload: UpdatePresentationGroupeDto = { dureeMs: 8000, imageUrl: 'https://x/y.png' };
      const { controller, modifierGroupeExecute, setEntry } = buildController();

      await controller.modifierUnGroupe('Présentation', payload);

      expect(modifierGroupeExecute).toHaveBeenCalledWith('Présentation', payload);
      expect(setEntry).toHaveBeenCalledTimes(1);
    });
  });

  describe('PATCH /groupes/:groupe/deplacer', () => {
    it('moves the group and republishes the cache', async () => {
      const direction: DeplacerDirectionDto = { direction: 'bas' };
      const { controller, deplacerGroupeExecute, setEntry } = buildController();

      await controller.deplacerUnGroupe('Présentation', direction);

      expect(deplacerGroupeExecute).toHaveBeenCalledWith('Présentation', direction);
      expect(setEntry).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE /groupes/:groupe', () => {
    it('deletes the group and republishes the cache', async () => {
      const { controller, supprimerGroupeExecute, setEntry } = buildController();

      await controller.supprimerUnGroupe('Présentation');

      expect(supprimerGroupeExecute).toHaveBeenCalledWith('Présentation');
      expect(setEntry).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /image/:fileId (public relay to Drive)', () => {
    it('streams the proxied image bytes with their content type and a cache header', async () => {
      const buffer = Buffer.from([1, 2, 3]);
      const { controller, imageFetch } = buildController({
        imageFetch: jest.fn().mockResolvedValue({ buffer, contentType: 'image/jpeg' }),
      });
      const res = makeMockResponse();

      await controller.image('FILE_ID', '1600', res as never);

      expect(imageFetch).toHaveBeenCalledWith('FILE_ID', 1600);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'public, max-age=3600');
      expect(res.send).toHaveBeenCalledWith(buffer);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('responds 502 without throwing when the proxy could not fetch the image', async () => {
      const { controller } = buildController({ imageFetch: jest.fn().mockResolvedValue(null) });
      const res = makeMockResponse();

      await controller.image('FILE_ID', '1600', res as never);

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.end).toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
    });

    it('defaults to width 1600 when none is given', async () => {
      const { controller, imageFetch } = buildController();
      const res = makeMockResponse();

      await controller.image('FILE_ID', undefined, res as never);

      expect(imageFetch).toHaveBeenCalledWith('FILE_ID', 1600);
    });

    it('clamps an out-of-range width into [100, 2000]', async () => {
      const { controller, imageFetch } = buildController();
      const res = makeMockResponse();

      await controller.image('FILE_ID', '50', res as never);
      await controller.image('FILE_ID', '5000', res as never);

      expect(imageFetch).toHaveBeenNthCalledWith(1, 'FILE_ID', 100);
      expect(imageFetch).toHaveBeenNthCalledWith(2, 'FILE_ID', 2000);
    });

    it('falls back to 1600 for a non-numeric width instead of propagating NaN', async () => {
      const { controller, imageFetch } = buildController();
      const res = makeMockResponse();

      await controller.image('FILE_ID', 'not-a-number', res as never);

      expect(imageFetch).toHaveBeenCalledWith('FILE_ID', 1600);
    });
  });
});
