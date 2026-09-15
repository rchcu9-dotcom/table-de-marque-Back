import { PrismaPlanningMatchWriter } from './prisma-planning-match-writer.repository';
import { makeMatchGenere } from '../../application/services/__fixtures__/planning.fixtures';

function makePrisma() {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    planningMatchSlot: {
      upsert: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (cb: (tx: typeof tx) => Promise<void>) => cb(tx)),
    $executeRaw: jest.fn().mockResolvedValue(1),
    taMatch: {
      findUnique: jest.fn(),
    },
    taEquipe: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
    },
  };
  return { prisma, tx };
}

describe('PrismaPlanningMatchWriter', () => {
  describe('ecrireMatchs', () => {
    it('insère chaque match dans TA_MATCHS et retourne le nombre de matchs traités', async () => {
      const { prisma, tx } = makePrisma();
      const writer = new PrismaPlanningMatchWriter(prisma as any);
      const matches = [
        makeMatchGenere({ numMatch: 1, equipe1Ref: 'real:1', equipe2Ref: 'real:2' }),
        makeMatchGenere({ numMatch: 2, equipe1Ref: 'real:3', equipe2Ref: 'real:4' }),
      ];

      const count = await writer.ecrireMatchs(
        matches,
        new Map([['real:1', 1], ['real:2', 2], ['real:3', 3], ['real:4', 4]]),
        7,
      );

      expect(count).toBe(2);
      expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('ne crée aucun slot quand les deux côtés du match sont déjà résolus', async () => {
      const { prisma, tx } = makePrisma();
      const writer = new PrismaPlanningMatchWriter(prisma as any);
      const matches = [makeMatchGenere({ numMatch: 1, equipe1Ref: 'real:1', equipe2Ref: 'real:2' })];

      await writer.ecrireMatchs(matches, new Map([['real:1', 1], ['real:2', 2]]), 7);

      expect(tx.planningMatchSlot.upsert).not.toHaveBeenCalled();
    });

    it("crée un slot 'poule' pour un côté non résolu, avec pouleCode/rangPoule extraits de la ref", async () => {
      const { prisma, tx } = makePrisma();
      const writer = new PrismaPlanningMatchWriter(prisma as any);
      const matches = [
        makeMatchGenere({
          numMatch: 20,
          equipe1Ref: 'placeholder:poule-A-rang-2',
          equipe1Nom: '2e Poule A',
          equipe2Ref: 'real:1',
          equipe2Nom: 'Aigles',
        }),
      ];

      await writer.ecrireMatchs(matches, new Map([['real:1', 1]]), 7);

      expect(tx.planningMatchSlot.upsert).toHaveBeenCalledTimes(1);
      expect(tx.planningMatchSlot.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { numMatch_cote: { numMatch: 20, cote: 1 } },
          create: expect.objectContaining({
            editionId: 7,
            numMatch: 20,
            cote: 1,
            ref: 'placeholder:poule-A-rang-2',
            libellePlaceholder: '2e Poule A',
            numMatchSource: null,
            pouleCode: 'A',
            rangPoule: 2,
          }),
        }),
      );
    });

    it('crée un slot "vainqueur" avec numMatchSource retrouvé via refVainqueurProduit du match source', async () => {
      const { prisma, tx } = makePrisma();
      const writer = new PrismaPlanningMatchWriter(prisma as any);
      const matchSource = makeMatchGenere({
        numMatch: 10,
        equipe1Ref: 'real:1',
        equipe2Ref: 'real:2',
        refVainqueurProduit: 'placeholder:vainqueur-t1-m1',
      });
      const matchSuivant = makeMatchGenere({
        numMatch: 20,
        equipe1Ref: 'placeholder:vainqueur-t1-m1',
        equipe1Nom: 'Vainqueur Demi-finale 1',
        equipe2Ref: 'placeholder:vainqueur-t1-m2',
        equipe2Nom: 'Vainqueur Demi-finale 2',
      });

      await writer.ecrireMatchs(
        [matchSource, matchSuivant],
        new Map([['real:1', 1], ['real:2', 2]]),
        7,
      );

      expect(tx.planningMatchSlot.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { numMatch_cote: { numMatch: 20, cote: 1 } },
          create: expect.objectContaining({
            ref: 'placeholder:vainqueur-t1-m1',
            numMatchSource: 10,
            pouleCode: null,
            rangPoule: null,
          }),
        }),
      );
    });

    it('crée un slot avec numMatchSource null quand aucun match ne produit encore cette ref de vainqueur', async () => {
      const { prisma, tx } = makePrisma();
      const writer = new PrismaPlanningMatchWriter(prisma as any);
      const matches = [
        makeMatchGenere({
          numMatch: 20,
          equipe1Ref: 'placeholder:vainqueur-t1-m1',
          equipe1Nom: 'Vainqueur Demi-finale 1',
          equipe2Ref: 'real:1',
        }),
      ];

      await writer.ecrireMatchs(matches, new Map([['real:1', 1]]), 7);

      expect(tx.planningMatchSlot.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ numMatchSource: null }),
        }),
      );
    });

    it("crée un slot avec role='VAINQUEUR' (défaut) pour un côté alimenté par le rang 1 d'un Groupe MATCH_UNIQUE", async () => {
      const { prisma, tx } = makePrisma();
      const writer = new PrismaPlanningMatchWriter(prisma as any);
      const matchSource = makeMatchGenere({
        numMatch: 10,
        equipe1Ref: 'real:1',
        equipe2Ref: 'real:2',
        refVainqueurProduit: 'placeholder:groupe-5-rang-1',
        refPerdantProduit: 'placeholder:groupe-5-rang-2',
        groupeId: 5,
      });
      const matchSuivant = makeMatchGenere({
        numMatch: 20,
        equipe1Ref: 'placeholder:groupe-5-rang-1',
        equipe1Nom: 'Vainqueur Demi 1',
        equipe2Ref: 'real:9',
        groupeId: 6,
      });

      await writer.ecrireMatchs(
        [matchSource, matchSuivant],
        new Map([['real:1', 1], ['real:2', 2], ['real:9', 9]]),
        7,
      );

      expect(tx.planningMatchSlot.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { numMatch_cote: { numMatch: 20, cote: 1 } },
          create: expect.objectContaining({
            ref: 'placeholder:groupe-5-rang-1',
            numMatchSource: 10,
            role: 'VAINQUEUR',
          }),
        }),
      );
    });

    it("crée un slot avec role='PERDANT' pour un côté alimenté par le rang 2 (branche basse) d'un Groupe MATCH_UNIQUE — tableau haute/basse", async () => {
      const { prisma, tx } = makePrisma();
      const writer = new PrismaPlanningMatchWriter(prisma as any);
      const matchSource = makeMatchGenere({
        numMatch: 10,
        equipe1Ref: 'real:1',
        equipe2Ref: 'real:2',
        refVainqueurProduit: 'placeholder:groupe-5-rang-1',
        refPerdantProduit: 'placeholder:groupe-5-rang-2',
        groupeId: 5,
      });
      const matchPetiteFinale = makeMatchGenere({
        numMatch: 21,
        equipe1Ref: 'placeholder:groupe-5-rang-2',
        equipe1Nom: 'Perdant Demi 1',
        equipe2Ref: 'real:9',
        groupeId: 7,
      });

      await writer.ecrireMatchs(
        [matchSource, matchPetiteFinale],
        new Map([['real:1', 1], ['real:2', 2], ['real:9', 9]]),
        7,
      );

      expect(tx.planningMatchSlot.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { numMatch_cote: { numMatch: 21, cote: 1 } },
          create: expect.objectContaining({
            ref: 'placeholder:groupe-5-rang-2',
            numMatchSource: 10,
            role: 'PERDANT',
          }),
        }),
      );
    });
  });

  describe('resoudreSlot', () => {
    it('met à jour EQUIPE_ID1/EQUIPE1 pour le côté 1', async () => {
      const { prisma } = makePrisma();
      const writer = new PrismaPlanningMatchWriter(prisma as any);

      await writer.resoudreSlot(20, 1, 42, 'Aigles');

      const call = (prisma.$executeRaw as jest.Mock).mock.calls[0];
      expect(call[1]).toBe(42);
      expect(call[2]).toBe('Aigles');
      expect(call[3]).toBe(20);
    });

    it('met à jour EQUIPE_ID2/EQUIPE2 pour le côté 2', async () => {
      const { prisma } = makePrisma();
      const writer = new PrismaPlanningMatchWriter(prisma as any);

      await writer.resoudreSlot(20, 2, 42, 'Aigles');

      const call = (prisma.$executeRaw as jest.Mock).mock.calls[0];
      expect(call[1]).toBe(42);
      expect(call[2]).toBe('Aigles');
      expect(call[3]).toBe(20);
    });
  });

  describe('trouverEquipesMatch', () => {
    it('retourne les IDs et noms des deux équipes du match', async () => {
      const { prisma } = makePrisma();
      (prisma.taMatch.findUnique as jest.Mock).mockResolvedValue({
        equipeId1: 1,
        equipeId2: 2,
        equipe1: 'Aigles',
        equipe2: 'Loups',
      });
      const writer = new PrismaPlanningMatchWriter(prisma as any);

      const result = await writer.trouverEquipesMatch(20);

      expect(result).toEqual({ equipeId1: 1, equipeId2: 2, equipe1Nom: 'Aigles', equipe2Nom: 'Loups' });
    });

    it('retourne null si le match est introuvable', async () => {
      const { prisma } = makePrisma();
      (prisma.taMatch.findUnique as jest.Mock).mockResolvedValue(null);
      const writer = new PrismaPlanningMatchWriter(prisma as any);

      expect(await writer.trouverEquipesMatch(999)).toBeNull();
    });
  });

  describe('trouverEquipeIdParNom', () => {
    it('trouve une équipe par correspondance de nom normalisée (casse/espaces)', async () => {
      const { prisma } = makePrisma();
      (prisma.taEquipe.findMany as jest.Mock).mockResolvedValue([
        { id: 1, equipe: '  Les Aigles  ' },
        { id: 2, equipe: 'Les Loups' },
      ]);
      const writer = new PrismaPlanningMatchWriter(prisma as any);

      expect(await writer.trouverEquipeIdParNom('les aigles')).toBe(1);
    });

    it('retourne null si aucune équipe ne correspond', async () => {
      const { prisma } = makePrisma();
      (prisma.taEquipe.findMany as jest.Mock).mockResolvedValue([{ id: 1, equipe: 'Les Aigles' }]);
      const writer = new PrismaPlanningMatchWriter(prisma as any);

      expect(await writer.trouverEquipeIdParNom('Équipe Inconnue')).toBeNull();
    });
  });

  describe('trouverEquipeNomParId', () => {
    it('retourne le nom associé à un ID', async () => {
      const { prisma } = makePrisma();
      (prisma.taEquipe.findUnique as jest.Mock).mockResolvedValue({ equipe: 'Les Aigles' });
      const writer = new PrismaPlanningMatchWriter(prisma as any);

      expect(await writer.trouverEquipeNomParId(1)).toBe('Les Aigles');
    });

    it("retourne null si l'ID est introuvable", async () => {
      const { prisma } = makePrisma();
      (prisma.taEquipe.findUnique as jest.Mock).mockResolvedValue(null);
      const writer = new PrismaPlanningMatchWriter(prisma as any);

      expect(await writer.trouverEquipeNomParId(999)).toBeNull();
    });
  });
});
