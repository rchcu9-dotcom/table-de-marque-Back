import { PrismaActiviteCatalogueRepository } from './prisma-activite-catalogue.repository';

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    editionId: 1,
    label: 'Repas',
    dureeParEquipeMin: 40,
    capaciteParallele: 4,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makePrisma() {
  return {
    activiteCatalogue: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(makeRow()),
      update: jest.fn().mockResolvedValue(makeRow()),
      delete: jest.fn().mockResolvedValue(makeRow()),
    },
  };
}

describe('PrismaActiviteCatalogueRepository', () => {
  describe('findByEdition', () => {
    it("filtre par édition et trie par id croissant", async () => {
      const prisma = makePrisma();
      const repo = new PrismaActiviteCatalogueRepository(prisma as any);

      await repo.findByEdition(1);

      expect(prisma.activiteCatalogue.findMany).toHaveBeenCalledWith({
        where: { editionId: 1 },
        orderBy: { id: 'asc' },
      });
    });

    it('mappe les lignes en entités ActiviteCatalogue', async () => {
      const prisma = makePrisma();
      prisma.activiteCatalogue.findMany.mockResolvedValue([makeRow({ id: 5, label: 'Challenge' })]);
      const repo = new PrismaActiviteCatalogueRepository(prisma as any);

      const [entity] = await repo.findByEdition(1);

      expect(entity.id).toBe(5);
      expect(entity.label).toBe('Challenge');
    });
  });

  describe('create', () => {
    it("crée une ligne rattachée à l'édition avec les champs fournis", async () => {
      const prisma = makePrisma();
      const repo = new PrismaActiviteCatalogueRepository(prisma as any);

      await repo.create(1, { label: 'Photo', dureeParEquipeMin: 15, capaciteParallele: 2 });

      expect(prisma.activiteCatalogue.create).toHaveBeenCalledWith({
        data: { editionId: 1, label: 'Photo', dureeParEquipeMin: 15, capaciteParallele: 2 },
      });
    });
  });

  describe('update', () => {
    it("met à jour la ligne identifiée par son id", async () => {
      const prisma = makePrisma();
      const repo = new PrismaActiviteCatalogueRepository(prisma as any);

      await repo.update(1, 1, { label: 'Repas', dureeParEquipeMin: 45, capaciteParallele: 6 });

      expect(prisma.activiteCatalogue.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { editionId: 1, label: 'Repas', dureeParEquipeMin: 45, capaciteParallele: 6 },
      });
    });
  });

  describe('delete', () => {
    it("supprime la ligne identifiée par son id (cascade créneaux gérée par la contrainte DB onDelete: Cascade)", async () => {
      const prisma = makePrisma();
      const repo = new PrismaActiviteCatalogueRepository(prisma as any);

      await repo.delete(1, 1);

      expect(prisma.activiteCatalogue.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });
});
