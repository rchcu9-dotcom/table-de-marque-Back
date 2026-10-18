import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    nomComplet: null,
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

  // docs/specs/-prise-en-compte-du-nom-court-pour-les-logos-contexte-actuel.md
  describe('nom complet', () => {
    it('enregistre le nom complet fourni, à côté du nom court (CA5)', async () => {
      const create = jest.fn().mockResolvedValue(
        makeRawEquipe({ nom: 'Courbevoie', nomComplet: 'Les Coqs de Courbevoie' }),
      );
      const useCase = new CreateEquipeReferentielUseCase(makePrisma(create));

      const result = await useCase.execute({
        nom: 'Courbevoie',
        nomComplet: 'Les Coqs de Courbevoie',
      });

      expect(create).toHaveBeenCalledWith({
        data: {
          nom: 'Courbevoie',
          nomComplet: 'Les Coqs de Courbevoie',
          logoUrl: null,
          active: true,
        },
      });
      expect(result.nom).toBe('Courbevoie');
      expect(result.nomComplet).toBe('Les Coqs de Courbevoie');
    });

    it('enregistre nomComplet à null quand le dto ne le renseigne pas (CA2)', async () => {
      const create = jest.fn().mockResolvedValue(makeRawEquipe({ nom: 'Rennes' }));
      const useCase = new CreateEquipeReferentielUseCase(makePrisma(create));

      const result = await useCase.execute({ nom: 'Rennes' });

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({ nom: 'Rennes', nomComplet: null }),
      });
      expect(result.nomComplet).toBeNull();
    });

    it.each([
      ['vide', ''],
      ["composé d'espaces", '   '],
      ['égal au nom court', 'Rennes'],
      ['égal au nom court à la casse près', 'RENNES'],
    ])('enregistre null pour un nom complet %s (CA6)', async (_cas, nomComplet) => {
      const create = jest.fn().mockResolvedValue(makeRawEquipe({ nom: 'Rennes' }));
      const useCase = new CreateEquipeReferentielUseCase(makePrisma(create));

      await useCase.execute({ nom: 'Rennes', nomComplet });

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({ nomComplet: null }),
      });
    });

    it('retire les espaces de bord du nom complet (CA6)', async () => {
      const create = jest.fn().mockResolvedValue(makeRawEquipe());
      const useCase = new CreateEquipeReferentielUseCase(makePrisma(create));

      await useCase.execute({ nom: 'Courbevoie', nomComplet: '  Les Coqs de Courbevoie ' });

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({ nomComplet: 'Les Coqs de Courbevoie' }),
      });
    });
  });

  // docs/specs/-correction-des-anomalies-dans-la-liste-contexte-dans-la-lis.md — §2
  describe("contrôles d'écriture : espaces et emoji", () => {
    const RENARD = '\u{1F98A}';

    it('enregistre le nom court et le nom complet sans espaces parasites (CA4)', async () => {
      const create = jest.fn().mockResolvedValue(makeRawEquipe());
      const useCase = new CreateEquipeReferentielUseCase(makePrisma(create));

      await useCase.execute({
        nom: '  Rennes  ',
        nomComplet: 'Les  Cormorans de Rennes ',
      });

      expect(create).toHaveBeenCalledWith({
        data: {
          nom: 'Rennes',
          nomComplet: 'Les Cormorans de Rennes',
          logoUrl: null,
          active: true,
        },
      });
    });

    it('réduit les espaces internes du nom court, espace insécable compris', async () => {
      const create = jest.fn().mockResolvedValue(makeRawEquipe());
      const useCase = new CreateEquipeReferentielUseCase(makePrisma(create));

      await useCase.execute({ nom: 'Le\u{00A0} Havre' });

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({ nom: 'Le Havre' }),
      });
    });

    it('compare le nom complet au nom court une fois les deux nettoyés', async () => {
      const create = jest.fn().mockResolvedValue(makeRawEquipe());
      const useCase = new CreateEquipeReferentielUseCase(makePrisma(create));

      await useCase.execute({ nom: ' Le  Havre ', nomComplet: 'le havre' });

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({ nom: 'Le Havre', nomComplet: null }),
      });
    });

    it('ne modifie pas la casse du nom saisi', async () => {
      const create = jest.fn().mockResolvedValue(makeRawEquipe());
      const useCase = new CreateEquipeReferentielUseCase(makePrisma(create));

      await useCase.execute({
        nom: 'Toulouse',
        nomComplet: 'Les Belougas De Toulouse Blagnac',
      });

      // « De » → « de » est une correction ponctuelle de données, pas une règle d'écriture.
      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nomComplet: 'Les Belougas De Toulouse Blagnac',
        }),
      });
    });

    it("ne « corrige » pas Damarie à la création : pas de réécriture silencieuse d'une saisie", async () => {
      const create = jest.fn().mockResolvedValue(makeRawEquipe());
      const useCase = new CreateEquipeReferentielUseCase(makePrisma(create));

      await useCase.execute({ nom: 'Damarie-Cergy' });

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({ nom: 'Damarie-Cergy' }),
      });
    });

    it.each([
      ['dans le nom court', { nom: `Les ${RENARD} Trois-Chêne` }],
      ['dans le nom complet', { nom: 'Trois-Chêne', nomComplet: `Les ${RENARD} Trois-Chêne` }],
      ['drapeau dans le nom court', { nom: 'France \u{1F1EB}\u{1F1F7}' }],
    ])('refuse un emoji %s sans rien insérer (CA5)', async (_cas, dto) => {
      const create = jest.fn();
      const useCase = new CreateEquipeReferentielUseCase(makePrisma(create));

      const promesse = useCase.execute(dto);

      await expect(promesse).rejects.toBeInstanceOf(BadRequestException);
      await expect(promesse).rejects.toThrow("Le nom ne doit pas contenir d'emoji");
      expect(create).not.toHaveBeenCalled();
    });

    it.each([['vide', ''], ["fait d'espaces", '   '], ['fait de blancs insécables', '\u{00A0}\t']])(
      'refuse un nom court %s sans rien insérer',
      async (_cas, nom) => {
        const create = jest.fn();
        const useCase = new CreateEquipeReferentielUseCase(makePrisma(create));

        const promesse = useCase.execute({ nom });

        await expect(promesse).rejects.toBeInstanceOf(BadRequestException);
        await expect(promesse).rejects.toThrow('Le nom est obligatoire');
        expect(create).not.toHaveBeenCalled();
      },
    );

    it('accepte accents, tirets, apostrophes et chiffres', async () => {
      const create = jest.fn().mockResolvedValue(makeRawEquipe());
      const useCase = new CreateEquipeReferentielUseCase(makePrisma(create));

      await useCase.execute({ nom: 'Évry-Viry 2', nomComplet: "Les Jets d'Évry #1" });

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nom: 'Évry-Viry 2',
          nomComplet: "Les Jets d'Évry #1",
        }),
      });
    });

    it('un doublon reste un 409, pas un 400 : les contrôles ne masquent pas le P2002', async () => {
      const create = jest.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('doublon', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      const useCase = new CreateEquipeReferentielUseCase(makePrisma(create));

      await expect(useCase.execute({ nom: '  Rennes ' })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({ nom: 'Rennes' }),
      });
    });
  });

  describe('unicité du nom court (CA8)', () => {
    function erreurPrisma(code: string) {
      return new Prisma.PrismaClientKnownRequestError('erreur base', {
        code,
        clientVersion: 'test',
      });
    }

    it("traduit la violation de l'index unique (P2002) en ConflictException", async () => {
      const create = jest.fn().mockRejectedValue(erreurPrisma('P2002'));
      const useCase = new CreateEquipeReferentielUseCase(makePrisma(create));

      const promesse = useCase.execute({ nom: 'Rennes' });

      await expect(promesse).rejects.toBeInstanceOf(ConflictException);
      await expect(promesse).rejects.toThrow('Cette équipe existe déjà');
    });

    it('relance telle quelle une autre erreur Prisma connue', async () => {
      const erreur = erreurPrisma('P2025');
      const create = jest.fn().mockRejectedValue(erreur);
      const useCase = new CreateEquipeReferentielUseCase(makePrisma(create));

      await expect(useCase.execute({ nom: 'Rennes' })).rejects.toBe(erreur);
    });

    it('relance telle quelle une erreur quelconque (panne de base…)', async () => {
      const erreur = new Error('connexion perdue');
      const create = jest.fn().mockRejectedValue(erreur);
      const useCase = new CreateEquipeReferentielUseCase(makePrisma(create));

      await expect(useCase.execute({ nom: 'Rennes' })).rejects.toBe(erreur);
    });

    it("ne confond pas un objet portant code 'P2002' avec une erreur Prisma", async () => {
      const erreur = Object.assign(new Error('faux P2002'), { code: 'P2002' });
      const create = jest.fn().mockRejectedValue(erreur);
      const useCase = new CreateEquipeReferentielUseCase(makePrisma(create));

      await expect(useCase.execute({ nom: 'Rennes' })).rejects.toBe(erreur);
    });
  });
});
