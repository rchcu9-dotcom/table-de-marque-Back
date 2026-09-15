import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaFormatGrapheRepository } from './prisma-format-graphe.repository';
import { FormatGraphePropose } from '../../domain/repositories/format-graphe.repository';

function makePrisma() {
  const tx = {
    formatPhase: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    formatPhaseJour: {
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    formatGroupe: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
    },
    formatPlace: {
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
    },
    formatLien: {
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
    },
    formatMeta: {
      upsert: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (cb: (tx: typeof tx) => unknown) => cb(tx)),
    formatPhase: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    formatMeta: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    formatGroupe: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    formatPlace: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
    },
    formatLien: {
      findUnique: jest.fn(),
    },
  };
  return { prisma, tx };
}

describe('PrismaFormatGrapheRepository', () => {
  describe('getGraphe', () => {
    it('assemble les phases/groupes/liens triés et la meta', async () => {
      const { prisma } = makePrisma();
      (prisma.formatPhase.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          editionId: 7,
          nom: 'Brassage',
          ordre: 1,
          jours: [{ editionJourId: 3 }],
          groupes: [
            {
              id: 10,
              phaseId: 1,
              nom: 'Poule A',
              ordre: 1,
              places: [
                {
                  id: 100,
                  groupeId: 10,
                  position: 1,
                  origine: 'ALIAS',
                  aliasLabel: 'Équipe A',
                  lienEntrant: null,
                },
              ],
              liensSortants: [
                {
                  id: 1000,
                  groupeSourceId: 10,
                  rangSource: 1,
                  etat: 'NON_DEFINI',
                  groupeCibleId: null,
                  placeCibleId: null,
                },
              ],
            },
          ],
        },
      ]);
      (prisma.formatMeta.findUnique as jest.Mock).mockResolvedValue({
        editionId: 7,
        genereDepuisPreset: 'POULES_FINALES',
        modifieManuellement: true,
        updatedAt: new Date('2026-09-08T00:00:00.000Z'),
      });

      const repo = new PrismaFormatGrapheRepository(prisma as any);
      const graphe = await repo.getGraphe(7);

      expect(graphe.editionId).toBe(7);
      expect(graphe.phases).toHaveLength(1);
      expect(graphe.phases[0].joursIds).toEqual([3]);
      expect(graphe.groupes).toHaveLength(1);
      expect(graphe.groupes[0].places[0].aliasLabel).toBe('Équipe A');
      expect(graphe.liens).toHaveLength(1);
      expect(graphe.modifieManuellement).toBe(true);
      expect(graphe.genereDepuisPreset).toBe('POULES_FINALES');
    });

    it('retourne un graphe vide (aucune phase) quand rien n’a encore été créé', async () => {
      const { prisma } = makePrisma();
      const repo = new PrismaFormatGrapheRepository(prisma as any);

      const graphe = await repo.getGraphe(99);

      expect(graphe.phases).toEqual([]);
      expect(graphe.groupes).toEqual([]);
      expect(graphe.liens).toEqual([]);
      expect(graphe.modifieManuellement).toBe(false);
      expect(graphe.genereDepuisPreset).toBeNull();
    });
  });

  describe('updateGroupe', () => {
    it('transmet formule seule à Prisma sans écraser nom (CA2/CA4 — pas de champ places/liensSortants dans data)', async () => {
      const { prisma } = makePrisma();
      (prisma.formatGroupe.update as jest.Mock).mockResolvedValue({
        id: 10,
        phaseId: 1,
        nom: 'Poule A',
        ordre: 1,
        formule: 'RONDE_SUISSE',
        places: [],
        liensSortants: [],
      });
      const repo = new PrismaFormatGrapheRepository(prisma as any);

      const groupe = await repo.updateGroupe(10, { formule: 'RONDE_SUISSE' as any });

      expect(prisma.formatGroupe.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10 },
          data: { nom: undefined, formule: 'RONDE_SUISSE' },
        }),
      );
      const dataArg = (prisma.formatGroupe.update as jest.Mock).mock.calls[0][0].data;
      expect(dataArg).not.toHaveProperty('places');
      expect(dataArg).not.toHaveProperty('liensSortants');
      expect(groupe.formule).toBe('RONDE_SUISSE');
    });

    it('transmet nom seul sans écraser formule', async () => {
      const { prisma } = makePrisma();
      (prisma.formatGroupe.update as jest.Mock).mockResolvedValue({
        id: 10,
        phaseId: 1,
        nom: 'Nouveau nom',
        ordre: 1,
        formule: 'CHAMPIONNAT',
        places: [],
        liensSortants: [],
      });
      const repo = new PrismaFormatGrapheRepository(prisma as any);

      await repo.updateGroupe(10, { nom: 'Nouveau nom' });

      expect(prisma.formatGroupe.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { nom: 'Nouveau nom', formule: undefined },
        }),
      );
    });

    it('mappe le champ formule retourné par Prisma sur l’entité FormatGroupe', async () => {
      const { prisma } = makePrisma();
      (prisma.formatGroupe.update as jest.Mock).mockResolvedValue({
        id: 10,
        phaseId: 1,
        nom: 'Poule A',
        ordre: 1,
        formule: 'CHAMPIONNAT',
        places: [],
        liensSortants: [],
      });
      const repo = new PrismaFormatGrapheRepository(prisma as any);

      const groupe = await repo.updateGroupe(10, { nom: 'Poule A' });

      expect(groupe.formule).toBe('CHAMPIONNAT');
    });
  });

  describe('updatePhase', () => {
    it('lève NotFoundException si la phase est introuvable', async () => {
      const { prisma } = makePrisma();
      (prisma.formatPhase.findUnique as jest.Mock).mockResolvedValue(null);
      const repo = new PrismaFormatGrapheRepository(prisma as any);

      await expect(repo.updatePhase(999, 'Nouveau nom')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('ajouterPlaceAlias', () => {
    it("crée la place en position suivante et synchronise le FormatLien NON_DEFINI du rang", async () => {
      const { prisma, tx } = makePrisma();
      (prisma.formatPlace.findMany as jest.Mock).mockResolvedValue([
        { position: 2 },
      ]);
      (tx.formatPlace.create as jest.Mock).mockResolvedValue({
        id: 1,
        groupeId: 10,
        position: 3,
        origine: 'ALIAS',
        aliasLabel: 'Équipe C',
      });
      const repo = new PrismaFormatGrapheRepository(prisma as any);

      const place = await repo.ajouterPlaceAlias(10, 'Équipe C');

      expect(place.position).toBe(3);
      expect(tx.formatLien.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            groupeSourceId_rangSource: { groupeSourceId: 10, rangSource: 3 },
          },
          create: expect.objectContaining({
            groupeSourceId: 10,
            rangSource: 3,
            etat: 'NON_DEFINI',
          }),
        }),
      );
    });
  });

  describe('definirLien', () => {
    it('rejette un lien entre deux phases non consécutives (CA4)', async () => {
      const { prisma } = makePrisma();
      (prisma.formatGroupe.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: 10, phase: { ordre: 1 } }) // source
        .mockResolvedValueOnce({ id: 30, phase: { ordre: 3 } }); // cible (saut de phase)
      const repo = new PrismaFormatGrapheRepository(prisma as any);

      await expect(repo.definirLien(10, 1, 30)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lève NotFoundException si le groupe source est introuvable', async () => {
      const { prisma } = makePrisma();
      (prisma.formatGroupe.findUnique as jest.Mock).mockResolvedValue(null);
      const repo = new PrismaFormatGrapheRepository(prisma as any);

      await expect(repo.definirLien(999, 1, 30)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('crée la place cible dans le groupe cible et passe le lien à LIE pour deux phases consécutives', async () => {
      const { prisma, tx } = makePrisma();
      (prisma.formatGroupe.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: 10, phase: { ordre: 1 } })
        .mockResolvedValueOnce({ id: 20, phase: { ordre: 2 } });
      (tx.formatLien.findUnique as jest.Mock).mockResolvedValue(null);
      (tx.formatPlace.findMany as jest.Mock).mockResolvedValue([]);
      (tx.formatPlace.create as jest.Mock).mockResolvedValue({ id: 500 });
      (tx.formatLien.upsert as jest.Mock).mockResolvedValue({
        id: 1000,
        groupeSourceId: 10,
        rangSource: 1,
        etat: 'LIE',
        groupeCibleId: 20,
        placeCibleId: 500,
      });

      const repo = new PrismaFormatGrapheRepository(prisma as any);
      const lien = await repo.definirLien(10, 1, 20);

      expect(lien.etat).toBe('LIE');
      expect(lien.groupeCibleId).toBe(20);
      expect(tx.formatPlace.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ groupeId: 20, origine: 'LIEE' }),
        }),
      );
    });

    it("refuse de remplacer un lien LIE dont l'ancienne place cible a déjà un lien sortant LIE", async () => {
      const { prisma, tx } = makePrisma();
      (prisma.formatGroupe.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: 10, phase: { ordre: 1 } })
        .mockResolvedValueOnce({ id: 21, phase: { ordre: 2 } });
      (tx.formatLien.findUnique as jest.Mock).mockResolvedValue({
        id: 1000,
        etat: 'LIE',
        groupeCibleId: 20,
        placeCibleId: 500,
      });
      (tx.formatLien.findMany as jest.Mock).mockResolvedValue([
        { id: 2000, etat: 'LIE' },
      ]);

      const repo = new PrismaFormatGrapheRepository(prisma as any);

      await expect(repo.definirLien(10, 1, 21)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('supprimerPlace', () => {
    it('lève NotFoundException si la place est introuvable', async () => {
      const { prisma } = makePrisma();
      (prisma.formatPlace.findUnique as jest.Mock).mockResolvedValue(null);
      const repo = new PrismaFormatGrapheRepository(prisma as any);

      await expect(repo.supprimerPlace(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("refuse de supprimer une place dont le lien sortant est déjà LIE", async () => {
      const { prisma, tx } = makePrisma();
      (prisma.formatPlace.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        groupeId: 10,
        position: 1,
        lienEntrant: null,
      });
      (tx.formatLien.findUnique as jest.Mock).mockResolvedValue({
        id: 1000,
        etat: 'LIE',
      });

      const repo = new PrismaFormatGrapheRepository(prisma as any);

      await expect(repo.supprimerPlace(1)).rejects.toThrow(ConflictException);
    });
  });

  describe('marquerElimine / reinitialiserLien', () => {
    it('marquerElimine positionne etat=ELIMINE et efface la cible', async () => {
      const { prisma } = makePrisma();
      (prisma.formatGroupe.findUnique as jest.Mock).mockResolvedValue(null);
      const repo = new PrismaFormatGrapheRepository(prisma as any);
      // formatLien.upsert est appelé directement sur `this.prisma`, pas `tx`
      (prisma as any).formatLien = {
        upsert: jest.fn().mockResolvedValue({
          id: 1,
          groupeSourceId: 10,
          rangSource: 2,
          etat: 'ELIMINE',
          groupeCibleId: null,
          placeCibleId: null,
        }),
      };

      const lien = await repo.marquerElimine(10, 2);

      expect(lien.etat).toBe('ELIMINE');
      expect(lien.groupeCibleId).toBeNull();
    });

    it('reinitialiserLien lève NotFoundException si aucun lien existant pour ce rang', async () => {
      const { prisma, tx } = makePrisma();
      (tx.formatLien.findUnique as jest.Mock).mockResolvedValue(null);
      const repo = new PrismaFormatGrapheRepository(prisma as any);

      await expect(repo.reinitialiserLien(10, 2)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remplacerGrapheComplet', () => {
    it('recrée phases/groupes/places/liens depuis la proposition et remet modifieManuellement à false', async () => {
      const { prisma, tx } = makePrisma();
      let phaseIdSeq = 1;
      (tx.formatPhase.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ id: phaseIdSeq++, ...data }),
      );
      let groupeIdSeq = 10;
      (tx.formatGroupe.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ id: groupeIdSeq++, ...data }),
      );
      (tx.formatPlace.findMany as jest.Mock).mockResolvedValue([]);
      let placeIdSeq = 100;
      (tx.formatPlace.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ id: placeIdSeq++, ...data }),
      );

      const propose: FormatGraphePropose = {
        phases: [
          {
            nom: 'Brassage',
            ordre: 1,
            groupes: [{ nom: 'Poule A', ordre: 1, nbPlaces: 2 }],
          },
          {
            nom: 'Finale',
            ordre: 2,
            groupes: [{ nom: 'Finale', ordre: 1, nbPlaces: 2 }],
          },
        ],
        liens: [
          {
            phaseOrdreSource: 1,
            groupeOrdreSource: 1,
            rangSource: 1,
            phaseOrdreCible: 2,
            groupeOrdreCible: 1,
            etat: 'LIE',
          },
          {
            phaseOrdreSource: 1,
            groupeOrdreSource: 1,
            rangSource: 2,
            phaseOrdreCible: null,
            groupeOrdreCible: null,
            etat: 'ELIMINE',
          },
        ],
      };

      const repo = new PrismaFormatGrapheRepository(prisma as any);
      await repo.remplacerGrapheComplet(7, propose);

      expect(tx.formatPhase.create).toHaveBeenCalledTimes(2);
      expect(tx.formatGroupe.create).toHaveBeenCalledTimes(2);
      // 2 places ALIAS pour la poule + 1 place LIEE créée par le lien LIE
      expect(tx.formatPlace.create).toHaveBeenCalledTimes(3);
      expect(tx.formatLien.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ etat: 'LIE' }) }),
      );
      expect(tx.formatMeta.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ modifieManuellement: false }),
        }),
      );
    });
  });

  describe('marquerModifieManuellement', () => {
    it('upsert FormatMeta avec modifieManuellement=true', async () => {
      const { prisma } = makePrisma();
      const repo = new PrismaFormatGrapheRepository(prisma as any);

      await repo.marquerModifieManuellement(7);

      expect(prisma.formatMeta.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { editionId: 7 },
          update: expect.objectContaining({ modifieManuellement: true }),
          create: expect.objectContaining({
            editionId: 7,
            modifieManuellement: true,
          }),
        }),
      );
    });
  });

  describe('getMeta', () => {
    it('retourne null si aucune meta n’existe encore', async () => {
      const { prisma } = makePrisma();
      (prisma.formatMeta.findUnique as jest.Mock).mockResolvedValue(null);
      const repo = new PrismaFormatGrapheRepository(prisma as any);

      expect(await repo.getMeta(7)).toBeNull();
    });

    it('mappe la ligne trouvée en entité FormatMeta', async () => {
      const { prisma } = makePrisma();
      (prisma.formatMeta.findUnique as jest.Mock).mockResolvedValue({
        editionId: 7,
        genereDepuisPreset: 'ELIMINATION_DIRECTE',
        modifieManuellement: false,
        updatedAt: new Date('2026-09-08T00:00:00.000Z'),
      });
      const repo = new PrismaFormatGrapheRepository(prisma as any);

      const meta = await repo.getMeta(7);

      expect(meta?.genereDepuisPreset).toBe('ELIMINATION_DIRECTE');
      expect(meta?.modifieManuellement).toBe(false);
    });
  });
});
