import { MySqlPresentationArticleRepository } from '@/infrastructure/persistence/mysql/mysql-presentation-article.repository';
import { PrismaService } from '@/infrastructure/persistence/mysql/prisma.service';

type Row = {
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
};

const row = (overrides: Partial<Row> = {}): Row => ({
  id: 1,
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
  groupeOrdre: 0,
  groupeDureeMs: 5000,
  groupeImageUrl: null,
  ...overrides,
});

function buildRepo(overrides: Record<string, jest.Mock> = {}) {
  const presentationArticle = {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    findUnique: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
  const prisma = {
    presentationArticle,
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;

  return { repo: new MySqlPresentationArticleRepository(prisma), presentationArticle, prisma };
}

describe('MySqlPresentationArticleRepository', () => {
  describe('findAllOrdered / create / update / delete', () => {
    it('maps every column, including the 3 group-meta fields, onto the domain record', async () => {
      const { repo, presentationArticle } = buildRepo({
        findMany: jest.fn().mockResolvedValue([
          row({ groupeOrdre: 2, groupeDureeMs: 8000, groupeImageUrl: 'https://x/img.png' }),
        ]),
      });

      const [record] = await repo.findAllOrdered();

      expect(presentationArticle.findMany).toHaveBeenCalledWith({
        orderBy: [{ ordre: 'asc' }, { id: 'asc' }],
      });
      expect(record.groupeOrdre).toBe(2);
      expect(record.groupeDureeMs).toBe(8000);
      expect(record.groupeImageUrl).toBe('https://x/img.png');
    });

    it('passes the full data object through to prisma.create', async () => {
      const created = row();
      const { repo, presentationArticle } = buildRepo({
        create: jest.fn().mockResolvedValue(created),
      });
      const data = {
        groupe: 'Présentation',
        groupeEn: 'Presentation',
        titre: 'Résumé',
        titreEn: 'Summary',
        description: 'd',
        descriptionEn: 'd',
        imageUrl: null,
        lienUrl: null,
        lieu: null,
        mapsQuery: null,
        ordre: 0,
        groupeOrdre: 0,
        groupeDureeMs: 5000,
        groupeImageUrl: null,
      };

      await repo.create(data);

      expect(presentationArticle.create).toHaveBeenCalledWith({ data });
    });

    it('deletes by id', async () => {
      const { repo, presentationArticle } = buildRepo();

      await repo.delete(5);

      expect(presentationArticle.delete).toHaveBeenCalledWith({ where: { id: 5 } });
    });
  });

  describe('updateGroupeMeta', () => {
    it('only includes the fields provided (partial update)', async () => {
      const { repo, presentationArticle } = buildRepo();

      await repo.updateGroupeMeta('Présentation', { dureeMs: 9000 });

      expect(presentationArticle.updateMany).toHaveBeenCalledWith({
        where: { groupe: 'Présentation' },
        data: { groupeDureeMs: 9000 },
      });
    });

    it('maps nom/nomEn onto the raw groupe/groupeEn columns', async () => {
      const { repo, presentationArticle } = buildRepo();

      await repo.updateGroupeMeta('Présentation', { nom: 'Nouveau nom', nomEn: 'New name' });

      expect(presentationArticle.updateMany).toHaveBeenCalledWith({
        where: { groupe: 'Présentation' },
        data: { groupe: 'Nouveau nom', groupeEn: 'New name' },
      });
    });

    it('allows explicitly clearing the image (imageUrl: null)', async () => {
      const { repo, presentationArticle } = buildRepo();

      await repo.updateGroupeMeta('Présentation', { imageUrl: null });

      expect(presentationArticle.updateMany).toHaveBeenCalledWith({
        where: { groupe: 'Présentation' },
        data: { groupeImageUrl: null },
      });
    });
  });

  describe('deplacerGroupe', () => {
    it('swaps groupeOrdre with the previous group when moving "haut"', async () => {
      const { repo, presentationArticle, prisma } = buildRepo({
        findMany: jest.fn().mockResolvedValue([
          { groupe: 'Présentation', groupeOrdre: 0 },
          { groupe: 'Règlement', groupeOrdre: 1 },
        ]),
      });

      await repo.deplacerGroupe('Règlement', 'haut');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(presentationArticle.updateMany).toHaveBeenCalledWith({
        where: { groupe: 'Règlement' },
        data: { groupeOrdre: 0 },
      });
      expect(presentationArticle.updateMany).toHaveBeenCalledWith({
        where: { groupe: 'Présentation' },
        data: { groupeOrdre: 1 },
      });
    });

    it('swaps groupeOrdre with the next group when moving "bas"', async () => {
      const { repo, presentationArticle } = buildRepo({
        findMany: jest.fn().mockResolvedValue([
          { groupe: 'Présentation', groupeOrdre: 0 },
          { groupe: 'Règlement', groupeOrdre: 1 },
        ]),
      });

      await repo.deplacerGroupe('Présentation', 'bas');

      expect(presentationArticle.updateMany).toHaveBeenCalledWith({
        where: { groupe: 'Présentation' },
        data: { groupeOrdre: 1 },
      });
      expect(presentationArticle.updateMany).toHaveBeenCalledWith({
        where: { groupe: 'Règlement' },
        data: { groupeOrdre: 0 },
      });
    });

    it('does nothing when the group is already first and direction is "haut"', async () => {
      const { repo, presentationArticle, prisma } = buildRepo({
        findMany: jest.fn().mockResolvedValue([
          { groupe: 'Présentation', groupeOrdre: 0 },
          { groupe: 'Règlement', groupeOrdre: 1 },
        ]),
      });

      await repo.deplacerGroupe('Présentation', 'haut');

      expect(presentationArticle.updateMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('does nothing when the group is already last and direction is "bas"', async () => {
      const { repo, presentationArticle } = buildRepo({
        findMany: jest.fn().mockResolvedValue([
          { groupe: 'Présentation', groupeOrdre: 0 },
          { groupe: 'Règlement', groupeOrdre: 1 },
        ]),
      });

      await repo.deplacerGroupe('Règlement', 'bas');

      expect(presentationArticle.updateMany).not.toHaveBeenCalled();
    });

    it('does nothing when the group is not found', async () => {
      const { repo, presentationArticle } = buildRepo({
        findMany: jest.fn().mockResolvedValue([{ groupe: 'Présentation', groupeOrdre: 0 }]),
      });

      await repo.deplacerGroupe('Inexistant', 'haut');

      expect(presentationArticle.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('deplacerArticle', () => {
    it('swaps ordre with the previous sibling in the same group when moving "haut"', async () => {
      const { repo, presentationArticle } = buildRepo({
        findUnique: jest.fn().mockResolvedValue({ id: 2, groupe: 'Présentation', ordre: 1 }),
        findMany: jest.fn().mockResolvedValue([
          { id: 1, ordre: 0 },
          { id: 2, ordre: 1 },
        ]),
      });

      await repo.deplacerArticle(2, 'haut');

      expect(presentationArticle.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { ordre: 0 },
      });
      expect(presentationArticle.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { ordre: 1 },
      });
    });

    it('does nothing when the article is already first in its group', async () => {
      const { repo, presentationArticle } = buildRepo({
        findUnique: jest.fn().mockResolvedValue({ id: 1, groupe: 'Présentation', ordre: 0 }),
        findMany: jest.fn().mockResolvedValue([
          { id: 1, ordre: 0 },
          { id: 2, ordre: 1 },
        ]),
      });

      await repo.deplacerArticle(1, 'haut');

      expect(presentationArticle.update).not.toHaveBeenCalled();
    });

    it('does nothing when the article does not exist', async () => {
      const { repo, presentationArticle } = buildRepo({
        findUnique: jest.fn().mockResolvedValue(null),
      });

      await repo.deplacerArticle(999, 'bas');

      expect(presentationArticle.findMany).not.toHaveBeenCalled();
      expect(presentationArticle.update).not.toHaveBeenCalled();
    });

    it('only considers siblings within the same groupe, ignoring other groups', async () => {
      const { repo, presentationArticle } = buildRepo({
        findUnique: jest.fn().mockResolvedValue({ id: 2, groupe: 'Présentation', ordre: 1 }),
        findMany: jest.fn().mockResolvedValue([
          { id: 1, ordre: 0 },
          { id: 2, ordre: 1 },
        ]),
      });

      await repo.deplacerArticle(2, 'bas');

      expect(presentationArticle.findMany).toHaveBeenCalledWith({
        where: { groupe: 'Présentation' },
        select: { id: true, ordre: true },
        orderBy: { ordre: 'asc' },
      });
      // no next sibling (index 1 is last) -> no-op
      expect(presentationArticle.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteGroupe', () => {
    it('deletes every article matching the group name', async () => {
      const { repo, presentationArticle } = buildRepo();

      await repo.deleteGroupe('Présentation');

      expect(presentationArticle.deleteMany).toHaveBeenCalledWith({
        where: { groupe: 'Présentation' },
      });
    });
  });
});
