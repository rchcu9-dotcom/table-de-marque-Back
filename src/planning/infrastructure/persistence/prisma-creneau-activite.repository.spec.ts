import { PrismaCreneauActiviteRepository } from './prisma-creneau-activite.repository';

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    editionId: 1,
    activiteId: 10,
    date: new Date('2026-05-23T00:00:00.000Z'),
    heureDebut: new Date('2026-05-23T12:00:00.000Z'),
    dureeMin: 40,
    equipeId: null,
    equipeLabel: null,
    statut: 'LIBRE',
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makePrisma() {
  const tx = {
    creneauActivite: {
      update: jest.fn().mockResolvedValue(makeRow({ statut: 'CONFIRME' })),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (cb: (tx: typeof tx) => Promise<void>) => cb(tx)),
    creneauActivite: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(makeRow()),
      update: jest.fn().mockResolvedValue(makeRow()),
      delete: jest.fn().mockResolvedValue(makeRow()),
    },
  };
  return { prisma, tx };
}

describe('PrismaCreneauActiviteRepository', () => {
  describe('findByEdition', () => {
    it('filtre par édition et trie par heureDebut croissante', async () => {
      const { prisma } = makePrisma();
      const repo = new PrismaCreneauActiviteRepository(prisma as any);

      await repo.findByEdition(1);

      expect(prisma.creneauActivite.findMany).toHaveBeenCalledWith({
        where: { editionId: 1 },
        orderBy: [{ heureDebut: 'asc' }],
      });
    });

    it('mappe les lignes en entités CreneauActivite', async () => {
      const { prisma } = makePrisma();
      prisma.creneauActivite.findMany.mockResolvedValue([makeRow({ id: 7 })]);
      const repo = new PrismaCreneauActiviteRepository(prisma as any);

      const [entity] = await repo.findByEdition(1);

      expect(entity.id).toBe(7);
    });
  });

  describe('findLibresByEdition', () => {
    it("filtre par édition et statut LIBRE", async () => {
      const { prisma } = makePrisma();
      const repo = new PrismaCreneauActiviteRepository(prisma as any);

      await repo.findLibresByEdition(1);

      expect(prisma.creneauActivite.findMany).toHaveBeenCalledWith({
        where: { editionId: 1, statut: 'LIBRE' },
        orderBy: [{ heureDebut: 'asc' }],
      });
    });
  });

  describe('findConfirmesByEdition', () => {
    it('filtre par édition et statut CONFIRME', async () => {
      const { prisma } = makePrisma();
      const repo = new PrismaCreneauActiviteRepository(prisma as any);

      await repo.findConfirmesByEdition(1);

      expect(prisma.creneauActivite.findMany).toHaveBeenCalledWith({
        where: { editionId: 1, statut: 'CONFIRME' },
        orderBy: [{ heureDebut: 'asc' }],
      });
    });
  });

  describe('create', () => {
    it("crée un créneau LIBRE (statut par défaut du schéma) rattaché à l'édition et à l'activité", async () => {
      const { prisma } = makePrisma();
      const repo = new PrismaCreneauActiviteRepository(prisma as any);
      const data = {
        activiteId: 10,
        date: new Date('2026-05-23T00:00:00.000Z'),
        heureDebut: new Date('2026-05-23T12:00:00.000Z'),
        dureeMin: 40,
      };

      await repo.create(1, data);

      expect(prisma.creneauActivite.create).toHaveBeenCalledWith({
        data: { editionId: 1, ...data },
      });
    });
  });

  describe('update', () => {
    it('met à jour la configuration du créneau (date/heureDebut/dureeMin/activiteId)', async () => {
      const { prisma } = makePrisma();
      const repo = new PrismaCreneauActiviteRepository(prisma as any);
      const data = {
        activiteId: 20,
        date: new Date('2026-05-24T00:00:00.000Z'),
        heureDebut: new Date('2026-05-24T13:00:00.000Z'),
        dureeMin: 30,
      };

      await repo.update(1, 1, data);

      expect(prisma.creneauActivite.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { editionId: 1, ...data },
      });
    });
  });

  describe('delete', () => {
    it('supprime le créneau identifié par son id', async () => {
      const { prisma } = makePrisma();
      const repo = new PrismaCreneauActiviteRepository(prisma as any);

      await repo.delete(1, 1);

      expect(prisma.creneauActivite.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('assignerEquipes', () => {
    it('met à jour chaque créneau assigné (equipeId/equipeLabel, statut CONFIRME) dans une transaction, plus jamais un INSERT', async () => {
      const { prisma, tx } = makePrisma();
      const repo = new PrismaCreneauActiviteRepository(prisma as any);

      await repo.assignerEquipes(1, [
        { creneauId: 1, equipeId: 42, equipeLabel: null },
        { creneauId: 2, equipeId: null, equipeLabel: '1er Poule A' },
      ]);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.creneauActivite.update).toHaveBeenCalledTimes(2);
      expect(tx.creneauActivite.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { equipeId: 42, equipeLabel: null, statut: 'CONFIRME' },
      });
      expect(tx.creneauActivite.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { equipeId: null, equipeLabel: '1er Poule A', statut: 'CONFIRME' },
      });
    });

    it('retourne les créneaux mis à jour, mappés en entités', async () => {
      const { prisma, tx } = makePrisma();
      tx.creneauActivite.update.mockResolvedValue(makeRow({ id: 1, equipeId: 42, statut: 'CONFIRME' }));
      const repo = new PrismaCreneauActiviteRepository(prisma as any);

      const result = await repo.assignerEquipes(1, [{ creneauId: 1, equipeId: 42, equipeLabel: null }]);

      expect(result).toHaveLength(1);
      expect(result[0].statut).toBe('CONFIRME');
      expect(result[0].equipeId).toBe(42);
    });
  });
});
