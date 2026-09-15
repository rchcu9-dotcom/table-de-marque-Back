import { NotFoundException } from '@nestjs/common';
import { PrismaPlanningMatchSlotRepository } from './prisma-planning-match-slot.repository';

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    editionId: 1,
    numMatch: 20,
    cote: 1,
    ref: 'placeholder:poule-A-rang-1',
    libellePlaceholder: '1er Poule A',
    numMatchSource: null,
    pouleCode: 'A',
    rangPoule: 1,
    resolu: false,
    equipeIdResolu: null,
    equipeNomResolu: null,
    resoluAt: null,
    resoluManuellement: false,
    createdAt: new Date('2026-09-06T00:00:00.000Z'),
    ...overrides,
  };
}

function makePrisma() {
  const prisma = {
    planningMatchSlot: {
      upsert: jest.fn().mockResolvedValue(makeRow()),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  return prisma;
}

describe('PrismaPlanningMatchSlotRepository', () => {
  describe('createMany', () => {
    it('upsert chaque slot sur la clé (numMatch, cote), sans écraser une résolution existante', async () => {
      const prisma = makePrisma();
      const repo = new PrismaPlanningMatchSlotRepository(prisma as any);

      await repo.createMany([
        {
          editionId: 1,
          numMatch: 20,
          cote: 1,
          ref: 'placeholder:poule-A-rang-1',
          libellePlaceholder: '1er Poule A',
          numMatchSource: null,
          pouleCode: 'A',
          rangPoule: 1,
        },
      ]);

      expect(prisma.planningMatchSlot.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { numMatch_cote: { numMatch: 20, cote: 1 } },
          update: {},
          create: expect.objectContaining({
            editionId: 1,
            numMatch: 20,
            cote: 1,
            pouleCode: 'A',
            rangPoule: 1,
          }),
        }),
      );
    });

    it('traite chaque slot indépendamment (un upsert par slot)', async () => {
      const prisma = makePrisma();
      const repo = new PrismaPlanningMatchSlotRepository(prisma as any);

      await repo.createMany([
        { editionId: 1, numMatch: 20, cote: 1, ref: 'a', libellePlaceholder: 'A', numMatchSource: null, pouleCode: 'A', rangPoule: 1 },
        { editionId: 1, numMatch: 20, cote: 2, ref: 'b', libellePlaceholder: 'B', numMatchSource: null, pouleCode: 'B', rangPoule: 1 },
      ]);

      expect(prisma.planningMatchSlot.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('findAllByEdition', () => {
    it('filtre par édition et trie par numMatch puis côté', async () => {
      const prisma = makePrisma();
      const repo = new PrismaPlanningMatchSlotRepository(prisma as any);

      await repo.findAllByEdition(1);

      expect(prisma.planningMatchSlot.findMany).toHaveBeenCalledWith({
        where: { editionId: 1 },
        orderBy: [{ numMatch: 'asc' }, { cote: 'asc' }],
      });
    });

    it('mappe les lignes en entités PlanningMatchSlot', async () => {
      const prisma = makePrisma();
      prisma.planningMatchSlot.findMany.mockResolvedValue([makeRow({ id: 5 })]);
      const repo = new PrismaPlanningMatchSlotRepository(prisma as any);

      const [entity] = await repo.findAllByEdition(1);

      expect(entity.id).toBe(5);
      expect(entity.pouleCode).toBe('A');
    });
  });

  describe('findNonResolusParPoule', () => {
    it('filtre par édition, poule et resolu=false', async () => {
      const prisma = makePrisma();
      const repo = new PrismaPlanningMatchSlotRepository(prisma as any);

      await repo.findNonResolusParPoule(1, 'A');

      expect(prisma.planningMatchSlot.findMany).toHaveBeenCalledWith({
        where: { editionId: 1, pouleCode: 'A', resolu: false },
      });
    });
  });

  describe('findByNumMatchSource', () => {
    it('filtre par numMatchSource et resolu=false', async () => {
      const prisma = makePrisma();
      const repo = new PrismaPlanningMatchSlotRepository(prisma as any);

      await repo.findByNumMatchSource(5);

      expect(prisma.planningMatchSlot.findMany).toHaveBeenCalledWith({
        where: { numMatchSource: 5, resolu: false },
      });
    });
  });

  describe('findById', () => {
    it('retourne null si la ligne est introuvable', async () => {
      const prisma = makePrisma();
      prisma.planningMatchSlot.findUnique.mockResolvedValue(null);
      const repo = new PrismaPlanningMatchSlotRepository(prisma as any);

      expect(await repo.findById(999)).toBeNull();
    });

    it('mappe la ligne trouvée en entité', async () => {
      const prisma = makePrisma();
      prisma.planningMatchSlot.findUnique.mockResolvedValue(makeRow({ id: 3 }));
      const repo = new PrismaPlanningMatchSlotRepository(prisma as any);

      const entity = await repo.findById(3);

      expect(entity?.id).toBe(3);
    });
  });

  describe('marquerResolu', () => {
    it('lève NotFoundException si le slot est introuvable', async () => {
      const prisma = makePrisma();
      prisma.planningMatchSlot.findUnique.mockResolvedValue(null);
      const repo = new PrismaPlanningMatchSlotRepository(prisma as any);

      await expect(repo.marquerResolu(999, 1, 'Aigles', false)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.planningMatchSlot.update).not.toHaveBeenCalled();
    });

    it('met à jour resolu/equipeIdResolu/equipeNomResolu/resoluAt/resoluManuellement', async () => {
      const prisma = makePrisma();
      prisma.planningMatchSlot.findUnique.mockResolvedValue(makeRow({ id: 1 }));
      prisma.planningMatchSlot.update.mockResolvedValue(
        makeRow({ id: 1, resolu: true, equipeIdResolu: 42, equipeNomResolu: 'Aigles', resoluManuellement: true }),
      );
      const repo = new PrismaPlanningMatchSlotRepository(prisma as any);

      const entity = await repo.marquerResolu(1, 42, 'Aigles', true);

      expect(prisma.planningMatchSlot.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          resolu: true,
          equipeIdResolu: 42,
          equipeNomResolu: 'Aigles',
          resoluManuellement: true,
        }),
      });
      expect(entity.resolu).toBe(true);
      expect(entity.equipeIdResolu).toBe(42);
    });
  });
});
