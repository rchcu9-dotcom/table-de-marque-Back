import { NotFoundException } from '@nestjs/common';
import { ValidateEquipeReferentielUseCase } from './validate-equipe-referentiel.usecase';
import { EquipeReferentiel } from '../../domain/entities/equipe-referentiel.entity';
import type { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';

// docs/specs/recommandations-finales-contexte-la-mise-en-place-de-la-colo.md — §5, CA9
// Activation / désactivation : cas d'usage antérieur à la feature, désormais appelé par
// l'écran de gestion des équipes. Il n'avait aucun test unitaire.

function makeRawEquipe(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    nom: 'Courbevoie',
    nomComplet: 'Les Coqs de Courbevoie',
    logoUrl: null,
    active: true,
    createdAt: new Date('2027-01-01'),
    updatedAt: new Date('2027-01-01'),
    ...overrides,
  };
}

function makePrisma(existant: ReturnType<typeof makeRawEquipe> | null) {
  const findUnique = jest.fn().mockResolvedValue(existant);
  const update = jest
    .fn()
    .mockImplementation((args: { data: { active: boolean } }) =>
      Promise.resolve({ ...existant, ...args.data }),
    );
  const count = jest.fn();
  const prisma = {
    inscEquipeReferentiel: { findUnique, update },
    inscInscription: { count, findMany: count, findFirst: count },
  } as unknown as InscriptionPrismaService;
  return { prisma, findUnique, update, count };
}

describe('ValidateEquipeReferentielUseCase', () => {
  it('désactive une équipe active, sans toucher à ses noms', async () => {
    const { prisma, update } = makePrisma(makeRawEquipe({ active: true }));
    const useCase = new ValidateEquipeReferentielUseCase(prisma);

    const equipe = await useCase.deactivate(7);

    expect(update).toHaveBeenCalledWith({ where: { id: 7 }, data: { active: false } });
    expect(equipe).toBeInstanceOf(EquipeReferentiel);
    expect(equipe.active).toBe(false);
    expect(equipe.nom).toBe('Courbevoie');
    expect(equipe.nomComplet).toBe('Les Coqs de Courbevoie');
  });

  it('réactive une équipe désactivée', async () => {
    const { prisma, update } = makePrisma(makeRawEquipe({ active: false }));
    const useCase = new ValidateEquipeReferentielUseCase(prisma);

    const equipe = await useCase.activate(7);

    expect(update).toHaveBeenCalledWith({ where: { id: 7 }, data: { active: true } });
    expect(equipe.active).toBe(true);
  });

  it('ne consulte pas les candidatures : la désactivation n’est pas bloquée par elles', async () => {
    const { prisma, count } = makePrisma(makeRawEquipe());
    const useCase = new ValidateEquipeReferentielUseCase(prisma);

    await expect(useCase.deactivate(7)).resolves.toBeInstanceOf(EquipeReferentiel);
    expect(count).not.toHaveBeenCalled();
  });

  it.each(['activate', 'deactivate'] as const)(
    '%s renvoie 404 pour une équipe inconnue et n’écrit rien',
    async (methode) => {
      const { prisma, update } = makePrisma(null);
      const useCase = new ValidateEquipeReferentielUseCase(prisma);

      await expect(useCase[methode](99)).rejects.toThrow(NotFoundException);
      expect(update).not.toHaveBeenCalled();
    },
  );
});
