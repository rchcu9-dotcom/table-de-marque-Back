import { CreateEquipeReferentielUseCase } from './create-equipe-referentiel.usecase';
import type { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import type { CreateEquipeReferentielDto } from './dto/create-equipe-referentiel.dto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRawEquipe(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    nom: 'Les Sharks',
    logoUrl: null,
    active: true,
    createdAt: new Date('2027-01-01'),
    updatedAt: new Date('2027-01-01'),
    ...overrides,
  };
}

function makePrisma(create: jest.Mock = jest.fn()) {
  return {
    inscEquipeReferentiel: { create },
  } as unknown as InscriptionPrismaService;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('CreateEquipeReferentielUseCase', () => {
  it("crée l'équipe avec active: true par défaut (docs/specs/la-validation-de-lajout-dune-quipe-car-absnete-du-formulaire.md, CA1/CA2 — plus de validation préalable obligatoire)", async () => {
    const create = jest.fn().mockResolvedValue(makeRawEquipe());
    const useCase = new CreateEquipeReferentielUseCase(makePrisma(create));
    const dto: CreateEquipeReferentielDto = { nom: 'Les Sharks' };

    await useCase.execute(dto);

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nom: 'Les Sharks',
        active: true,
      }),
    });
  });

  it('ne fournit pas logoUrl (null) quand le dto ne le renseigne pas', async () => {
    const create = jest.fn().mockResolvedValue(makeRawEquipe());
    const useCase = new CreateEquipeReferentielUseCase(makePrisma(create));

    await useCase.execute({ nom: 'Les Sharks' });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ logoUrl: null }),
    });
  });

  it('transmet logoUrl quand le dto le fournit', async () => {
    const create = jest.fn().mockResolvedValue(
      makeRawEquipe({ logoUrl: 'https://example.com/logo.png' }),
    );
    const useCase = new CreateEquipeReferentielUseCase(makePrisma(create));

    await useCase.execute({
      nom: 'Les Sharks',
      logoUrl: 'https://example.com/logo.png',
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ logoUrl: 'https://example.com/logo.png' }),
    });
  });

  it("retourne l'équipe créée mappée en entité de domaine, immédiatement active", async () => {
    const create = jest.fn().mockResolvedValue(makeRawEquipe({ id: 42, active: true }));
    const useCase = new CreateEquipeReferentielUseCase(makePrisma(create));

    const result = await useCase.execute({ nom: 'Les Sharks' });

    expect(result.id).toBe(42);
    expect(result.nom).toBe('Les Sharks');
    expect(result.active).toBe(true);
  });
});
