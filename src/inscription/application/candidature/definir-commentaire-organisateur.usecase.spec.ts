import { NotFoundException } from '@nestjs/common';
import { DefinirCommentaireOrganisateurUseCase } from './definir-commentaire-organisateur.usecase';
import type { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';

function makePrisma(found: unknown = { id: 3, equipeNom: 'Rennes' }) {
  const update = jest
    .fn()
    .mockImplementation(({ where, data }) =>
      Promise.resolve({ id: where.id, ...data }),
    );
  const prisma = {
    inscInscription: {
      findUnique: jest.fn().mockResolvedValue(found),
      update,
    },
  } as unknown as InscriptionPrismaService;
  return { prisma, update };
}

describe('DefinirCommentaireOrganisateurUseCase', () => {
  it('enregistre le commentaire (texte libre, espaces de bord retirés)', async () => {
    const { prisma, update } = makePrisma();
    const useCase = new DefinirCommentaireOrganisateurUseCase(prisma);

    const result = await useCase.execute(3, {
      commentaire: '  Chèque en retard\nrelancer lundi ',
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { commentaireOrganisateur: 'Chèque en retard\nrelancer lundi' },
    });
    expect(result).toEqual({
      id: 3,
      commentaireOrganisateur: 'Chèque en retard\nrelancer lundi',
    });
  });

  it('efface le commentaire (null) quand la saisie est vide', async () => {
    const { prisma, update } = makePrisma();
    const useCase = new DefinirCommentaireOrganisateurUseCase(prisma);

    const result = await useCase.execute(3, { commentaire: '   ' });

    expect(update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { commentaireOrganisateur: null },
    });
    expect(result.commentaireOrganisateur).toBeNull();
  });

  it("lève NotFoundException si la candidature n'existe pas", async () => {
    const { prisma, update } = makePrisma(null);
    const useCase = new DefinirCommentaireOrganisateurUseCase(prisma);

    await expect(useCase.execute(999, { commentaire: 'x' })).rejects.toThrow(
      NotFoundException,
    );
    expect(update).not.toHaveBeenCalled();
  });
});
