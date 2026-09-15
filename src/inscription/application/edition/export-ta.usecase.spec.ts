import { NotFoundException } from '@nestjs/common';
import { ExportTaUseCase } from './export-ta.usecase';
import type { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import type { PrismaService } from '@/infrastructure/persistence/mysql/prisma.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInscriptionPrisma(findUnique: jest.Mock) {
  return { inscEdition: { findUnique } } as unknown as InscriptionPrismaService;
}

function makeLegacyPrisma(overrides: {
  taMatch?: jest.Mock;
  taEquipe?: jest.Mock;
  taClassement?: jest.Mock;
  taJoueur?: jest.Mock;
  taConfiguration?: jest.Mock;
} = {}) {
  return {
    taMatch: { findMany: overrides.taMatch ?? jest.fn().mockResolvedValue([]) },
    taEquipe: { findMany: overrides.taEquipe ?? jest.fn().mockResolvedValue([]) },
    taClassement: { findMany: overrides.taClassement ?? jest.fn().mockResolvedValue([]) },
    taJoueur: { findMany: overrides.taJoueur ?? jest.fn().mockResolvedValue([]) },
    taConfiguration: {
      findMany: overrides.taConfiguration ?? jest.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaService;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ExportTaUseCase', () => {
  it("lève NotFoundException quand l'édition :id est introuvable, sans lire les tables TA_*", async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const taMatchFindMany = jest.fn();
    const useCase = new ExportTaUseCase(
      makeInscriptionPrisma(findUnique),
      makeLegacyPrisma({ taMatch: taMatchFindMany }),
    );

    await expect(useCase.execute(999)).rejects.toThrow(NotFoundException);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 999 } });
    expect(taMatchFindMany).not.toHaveBeenCalled();
  });

  it('lit les 5 tables TA_* (et seulement ces 5, pas ta_cache_snapshots) et les restitue sous les clés attendues', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValue({ id: 1, nom: 'RCHC U11 2026', annee: 2026 });
    const taMatchs = [{ numMatch: 1 }];
    const taEquipes = [{ id: 1, equipe: 'Les Sharks' }];
    const taClassement = [{ groupeNom: 'A', ordre: 1 }];
    const taJoueurs = [{ id: 1, nom: 'Doe' }];
    const taConfiguration = [{ id: 1, nbAvant: 2 }];
    const legacyPrisma = makeLegacyPrisma({
      taMatch: jest.fn().mockResolvedValue(taMatchs),
      taEquipe: jest.fn().mockResolvedValue(taEquipes),
      taClassement: jest.fn().mockResolvedValue(taClassement),
      taJoueur: jest.fn().mockResolvedValue(taJoueurs),
      taConfiguration: jest.fn().mockResolvedValue(taConfiguration),
    });
    const useCase = new ExportTaUseCase(makeInscriptionPrisma(findUnique), legacyPrisma);

    const result = await useCase.execute(1);

    expect(result.payload).toEqual({
      TA_MATCHS: taMatchs,
      ta_equipes: taEquipes,
      ta_classement: taClassement,
      ta_joueurs: taJoueurs,
      ta_configuration: taConfiguration,
    });
    expect(Object.keys(result.payload)).not.toContain('ta_cache_snapshots');
    expect(legacyPrisma.taMatch.findMany).toHaveBeenCalledWith();
    expect(legacyPrisma.taEquipe.findMany).toHaveBeenCalledWith();
    expect(legacyPrisma.taClassement.findMany).toHaveBeenCalledWith();
    expect(legacyPrisma.taJoueur.findMany).toHaveBeenCalledWith();
    expect(legacyPrisma.taConfiguration.findMany).toHaveBeenCalledWith();
  });

  it('nomme le fichier dump-ta-{annee}-{slug(nom)}.json', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValue({ id: 1, nom: 'RCHC U11 2026', annee: 2026 });
    const useCase = new ExportTaUseCase(
      makeInscriptionPrisma(findUnique),
      makeLegacyPrisma(),
    );

    const result = await useCase.execute(1);

    expect(result.filename).toBe('dump-ta-2026-rchc-u11-2026.json');
  });

  it('retire les accents et espaces du nom pour construire un nom de fichier valide', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValue({ id: 1, nom: 'Édition Été', annee: 2027 });
    const useCase = new ExportTaUseCase(
      makeInscriptionPrisma(findUnique),
      makeLegacyPrisma(),
    );

    const result = await useCase.execute(1);

    expect(result.filename).toBe('dump-ta-2027-edition-ete.json');
  });

  it('omet le segment de slug quand le nom ne produit aucun caractère valide', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 1, nom: '!!!', annee: 2027 });
    const useCase = new ExportTaUseCase(
      makeInscriptionPrisma(findUnique),
      makeLegacyPrisma(),
    );

    const result = await useCase.execute(1);

    expect(result.filename).toBe('dump-ta-2027.json');
  });

  it("ne filtre pas les 5 tables par :id (elles n'ont pas d'editionId) — :id sert uniquement au nom de fichier", async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValue({ id: 1, nom: 'RCHC U11 2026', annee: 2026 });
    const legacyPrisma = makeLegacyPrisma();
    const useCase = new ExportTaUseCase(makeInscriptionPrisma(findUnique), legacyPrisma);

    await useCase.execute(1);

    expect(legacyPrisma.taMatch.findMany).toHaveBeenCalledWith();
    expect((legacyPrisma.taMatch.findMany as jest.Mock).mock.calls[0]).toEqual([]);
  });
});
