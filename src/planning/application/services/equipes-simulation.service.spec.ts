import { EquipesSimulationService } from './equipes-simulation.service';

function makePrisma(overrides: {
  inscInscriptions?: { equipeRefId: number | null; equipeNom: string }[];
  taEquipes?: { id: number; equipe: string; equipeRefId: number | null }[];
} = {}) {
  return {
    inscInscription: {
      findMany: jest.fn().mockResolvedValue(overrides.inscInscriptions ?? []),
    },
    taEquipe: {
      findMany: jest.fn().mockResolvedValue(overrides.taEquipes ?? []),
    },
  };
}

describe('EquipesSimulationService', () => {
  it('résout les équipes réelles engagées via equipeRefId', async () => {
    const prisma = makePrisma({
      inscInscriptions: [{ equipeRefId: 10, equipeNom: 'Les Aigles' }],
      taEquipes: [{ id: 5, equipe: 'Les Aigles', equipeRefId: 10 }],
    });
    const service = new EquipesSimulationService(prisma as any);

    const { equipes, nbReel, nbFictif } = await service.resoudre(1, 4);

    expect(nbReel).toBe(1);
    expect(nbFictif).toBe(3);
    expect(equipes).toHaveLength(4);
    const reelle = equipes.find((e) => !e.fictive)!;
    expect(reelle.ref).toBe('real:5');
    expect(reelle.nom).toBe('Les Aigles');
    expect(reelle.equipeId).toBe(5);
  });

  it('complète avec des équipes fictives jusqu\'à la cible quand aucune équipe réelle n\'est engagée', async () => {
    const prisma = makePrisma();
    const service = new EquipesSimulationService(prisma as any);

    const { equipes, nbReel, nbFictif } = await service.resoudre(1, 3);

    expect(nbReel).toBe(0);
    expect(nbFictif).toBe(3);
    expect(equipes.every((e) => e.fictive)).toBe(true);
    expect(equipes.map((e) => e.nom)).toEqual([
      'Équipe 1',
      'Équipe 2',
      'Équipe 3',
    ]);
    expect(equipes.every((e) => e.equipeId === null)).toBe(true);
  });

  it('ne génère aucune équipe fictive si le nombre réel atteint déjà la cible', async () => {
    const prisma = makePrisma({
      inscInscriptions: [
        { equipeRefId: 10, equipeNom: 'A' },
        { equipeRefId: 11, equipeNom: 'B' },
      ],
      taEquipes: [
        { id: 1, equipe: 'A', equipeRefId: 10 },
        { id: 2, equipe: 'B', equipeRefId: 11 },
      ],
    });
    const service = new EquipesSimulationService(prisma as any);

    const { equipes, nbFictif } = await service.resoudre(1, 2);

    expect(nbFictif).toBe(0);
    expect(equipes).toHaveLength(2);
  });

  it('ne génère pas d\'équipe fictive en négatif si le nombre réel dépasse la cible', async () => {
    const prisma = makePrisma({
      inscInscriptions: [
        { equipeRefId: 10, equipeNom: 'A' },
        { equipeRefId: 11, equipeNom: 'B' },
        { equipeRefId: 12, equipeNom: 'C' },
      ],
      taEquipes: [
        { id: 1, equipe: 'A', equipeRefId: 10 },
        { id: 2, equipe: 'B', equipeRefId: 11 },
        { id: 3, equipe: 'C', equipeRefId: 12 },
      ],
    });
    const service = new EquipesSimulationService(prisma as any);

    const { equipes, nbFictif } = await service.resoudre(1, 2);

    expect(nbFictif).toBe(0);
    expect(equipes).toHaveLength(3);
  });

  it('ignore une inscription acceptée mais pas encore synchronisée côté ta_equipes (traitée comme équipe manquante)', async () => {
    const prisma = makePrisma({
      inscInscriptions: [{ equipeRefId: 99, equipeNom: 'Pas encore synchronisée' }],
      taEquipes: [], // aucune ligne ta_equipes pour equipeRefId=99
    });
    const service = new EquipesSimulationService(prisma as any);

    const { equipes, nbReel, nbFictif } = await service.resoudre(1, 2);

    expect(nbReel).toBe(0);
    expect(nbFictif).toBe(2);
    expect(equipes.every((e) => e.fictive)).toBe(true);
  });

  it('filtre la requête sur les statuts engagés et l\'édition demandée', async () => {
    const prisma = makePrisma();
    const service = new EquipesSimulationService(prisma as any);

    await service.resoudre(42, 4);

    expect(prisma.inscInscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          editionId: 42,
          statut: { in: ['VALIDEE', 'DOSSIER_EN_COURS', 'DOSSIER_COMPLET'] },
          equipeRefId: { not: null },
        }),
      }),
    );
  });
});
