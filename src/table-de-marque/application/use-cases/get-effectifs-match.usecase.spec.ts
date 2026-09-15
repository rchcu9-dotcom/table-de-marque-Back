import { GetEffectifsMatchUseCase } from './get-effectifs-match.usecase';
import type { TableDeMarquePrismaService } from '../../infrastructure/persistence/table-de-marque-prisma.service';
import type { EditionResolverService } from '@/inscription/application/shared/edition-resolver.service';

function makePrisma(overrides: {
  taMatchFindUnique?: jest.Mock;
  taEquipeFindUnique?: jest.Mock;
  inscInscriptionFindFirst?: jest.Mock;
} = {}) {
  return {
    taMatch: {
      findUnique: overrides.taMatchFindUnique ?? jest.fn().mockResolvedValue(null),
    },
    taEquipe: {
      findUnique: overrides.taEquipeFindUnique ?? jest.fn().mockResolvedValue(null),
    },
    inscInscription: {
      findFirst: overrides.inscInscriptionFindFirst ?? jest.fn().mockResolvedValue(null),
    },
  } as unknown as TableDeMarquePrismaService;
}

function makeEditionResolver(getEditionActive: jest.Mock) {
  return {
    getEditionActive,
  } as unknown as EditionResolverService;
}

describe('GetEffectifsMatchUseCase', () => {
  describe('execute()', () => {
    it('retourne des listes vides si le match n\'existe pas en base', async () => {
      const prisma = makePrisma({
        taMatchFindUnique: jest.fn().mockResolvedValue(null),
      });
      const editionResolver = makeEditionResolver(
        jest.fn().mockResolvedValue({ id: 10 }),
      );
      const useCase = new GetEffectifsMatchUseCase(prisma, editionResolver);

      const result = await useCase.execute(1);

      expect(result.equipe1.joueurs).toEqual([]);
      expect(result.equipe1.coachs).toEqual([]);
      expect(result.equipe2.joueurs).toEqual([]);
      expect(result.equipe2.coachs).toEqual([]);
    });

    it('retourne des listes vides si l\'équipe n\'a pas d\'equipeRefId (D1)', async () => {
      const prisma = makePrisma({
        taMatchFindUnique: jest.fn().mockResolvedValue({
          equipeId1: 1,
          equipeId2: 2,
          equipe1: 'Rennes',
          equipe2: 'Paris',
        }),
        taEquipeFindUnique: jest.fn().mockResolvedValue({
          id: 1,
          equipe: 'Rennes',
          equipeRefId: null,
        }),
        inscInscriptionFindFirst: jest.fn().mockResolvedValue(null),
      });
      const editionResolver = makeEditionResolver(
        jest.fn().mockResolvedValue({ id: 10 }),
      );
      const useCase = new GetEffectifsMatchUseCase(prisma, editionResolver);

      const result = await useCase.execute(1);

      expect(result.equipe1.joueurs).toEqual([]);
      expect(result.equipe1.coachs).toEqual([]);
    });

    it('retourne des listes vides si aucune inscription n\'existe pour l\'édition active', async () => {
      const prisma = makePrisma({
        taMatchFindUnique: jest.fn().mockResolvedValue({
          equipeId1: 1,
          equipeId2: 2,
          equipe1: 'Rennes',
          equipe2: 'Paris',
        }),
        taEquipeFindUnique: jest.fn().mockResolvedValue({
          id: 1,
          equipe: 'Rennes',
          equipeRefId: 50,
        }),
        inscInscriptionFindFirst: jest.fn().mockResolvedValue(null),
      });
      const editionResolver = makeEditionResolver(
        jest.fn().mockResolvedValue({ id: 10 }),
      );
      const useCase = new GetEffectifsMatchUseCase(prisma, editionResolver);

      const result = await useCase.execute(1);

      expect(result.equipe1.joueurs).toEqual([]);
      expect(result.equipe1.coachs).toEqual([]);
    });

    it('retourne des listes vides si l\'inscription n\'a pas de dossier', async () => {
      const prisma = makePrisma({
        taMatchFindUnique: jest.fn().mockResolvedValue({
          equipeId1: 1,
          equipeId2: 2,
          equipe1: 'Rennes',
          equipe2: 'Paris',
        }),
        taEquipeFindUnique: jest.fn().mockResolvedValue({
          id: 1,
          equipe: 'Rennes',
          equipeRefId: 50,
        }),
        inscInscriptionFindFirst: jest.fn().mockResolvedValue({ dossier: null }),
      });
      const editionResolver = makeEditionResolver(
        jest.fn().mockResolvedValue({ id: 10 }),
      );
      const useCase = new GetEffectifsMatchUseCase(prisma, editionResolver);

      const result = await useCase.execute(1);

      expect(result.equipe1.joueurs).toEqual([]);
      expect(result.equipe1.coachs).toEqual([]);
    });

    it('retourne les joueurs et coachs du dossier quand tout est renseigné', async () => {
      const joueurs = [
        { id: 1, nom: 'Dupont', prenom: 'Paul', numero: 11, poste: 'ATT' },
        { id: 2, nom: 'Martin', prenom: 'Luc', numero: 7, poste: 'DEF' },
      ];
      const coachs = [{ id: 10, nom: 'Leblanc', prenom: 'Marc' }];

      const prisma = makePrisma({
        taMatchFindUnique: jest.fn().mockResolvedValue({
          equipeId1: 1,
          equipeId2: 2,
          equipe1: 'Rennes',
          equipe2: 'Paris',
        }),
        taEquipeFindUnique: jest.fn().mockResolvedValue({
          id: 1,
          equipe: 'Rennes',
          equipeRefId: 50,
        }),
        inscInscriptionFindFirst: jest.fn().mockResolvedValue({
          dossier: { joueurs, coachs },
        }),
      });
      const editionResolver = makeEditionResolver(
        jest.fn().mockResolvedValue({ id: 10 }),
      );
      const useCase = new GetEffectifsMatchUseCase(prisma, editionResolver);

      const result = await useCase.execute(1);

      expect(result.equipe1.joueurs).toHaveLength(2);
      expect(result.equipe1.coachs).toHaveLength(1);
      expect(result.equipe1.nom).toBe('Rennes');
    });

    it('retourne des listes vides sans lever d\'erreur si l\'édition active est introuvable', async () => {
      const prisma = makePrisma({
        taMatchFindUnique: jest.fn().mockResolvedValue({
          equipeId1: 1,
          equipeId2: 2,
          equipe1: 'Rennes',
          equipe2: 'Paris',
        }),
        taEquipeFindUnique: jest.fn().mockResolvedValue({
          id: 1,
          equipe: 'Rennes',
          equipeRefId: 50,
        }),
        inscInscriptionFindFirst: jest.fn().mockResolvedValue(null),
      });
      const editionResolver = makeEditionResolver(
        jest.fn().mockRejectedValue(new Error('Aucune édition active')),
      );
      const useCase = new GetEffectifsMatchUseCase(prisma, editionResolver);

      // Ne doit pas lever d'exception (critère d'acceptation : liste vide plutôt qu'erreur)
      const result = await useCase.execute(1);

      expect(result.equipe1.joueurs).toEqual([]);
      expect(result.equipe2.joueurs).toEqual([]);
    });
  });
});
