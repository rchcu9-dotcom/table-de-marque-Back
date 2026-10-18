import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UpdateEquipeReferentielUseCase } from './update-equipe-referentiel.usecase';
import { EquipeReferentiel } from '../../domain/entities/equipe-referentiel.entity';
import {
  MESSAGE_NOM_COURT_VERROUILLE,
  MESSAGE_NOM_OBLIGATOIRE,
  MESSAGE_NOM_SANS_EMOJI,
} from '../../domain/equipe-referentiel-noms';
import type { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';

// docs/specs/recommandations-finales-contexte-la-mise-en-place-de-la-colo.md
// — §3 (modification des noms), §4 (verrou du nom court), §6 (route) ; CA4, CA5, CA7, CA8

const RENARD = '\u{1F98A}';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Brut = {
  id: number;
  nom: string;
  nomComplet: string | null;
  logoUrl: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function makeRawEquipe(overrides: Partial<Brut> = {}): Brut {
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

/**
 * Base simulée d'une seule équipe : `update` et `updateMany` modifient l'état,
 * la relecture le renvoie. `nbInscriptions` alimente `_count` à la lecture
 * initiale ; `updateManyCount` permet de simuler une candidature arrivée entre
 * la lecture et l'écriture (0 ligne modifiée).
 */
function makePrisma(options: {
  equipe?: Brut | null;
  nbInscriptions?: number;
  updateManyCount?: number;
  updateManyError?: unknown;
}) {
  let etat = options.equipe === undefined ? makeRawEquipe() : options.equipe;
  const findUnique = jest.fn().mockImplementation((args: { include?: unknown }) => {
    if (!etat) return Promise.resolve(null);
    return Promise.resolve(
      args.include
        ? { ...etat, _count: { inscriptions: options.nbInscriptions ?? 0 } }
        : { ...etat },
    );
  });
  const update = jest
    .fn()
    .mockImplementation((args: { data: Partial<Brut> }) => {
      etat = { ...(etat as Brut), ...args.data };
      return Promise.resolve({ ...etat });
    });
  const updateMany = jest
    .fn()
    .mockImplementation((args: { data: Partial<Brut> }) => {
      if (options.updateManyError) return Promise.reject(options.updateManyError);
      const count = options.updateManyCount ?? 1;
      if (count > 0) etat = { ...(etat as Brut), ...args.data };
      return Promise.resolve({ count });
    });
  const prisma = {
    inscEquipeReferentiel: { findUnique, update, updateMany },
  } as unknown as InscriptionPrismaService;
  return { prisma, findUnique, update, updateMany };
}

function erreurP2002() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('UpdateEquipeReferentielUseCase', () => {
  describe('équipe inconnue', () => {
    it('renvoie 404 et n’écrit rien', async () => {
      const { prisma, update, updateMany } = makePrisma({ equipe: null });
      const useCase = new UpdateEquipeReferentielUseCase(prisma);

      await expect(useCase.execute(99, { nom: 'Rennes' })).rejects.toThrow(
        NotFoundException,
      );
      expect(update).not.toHaveBeenCalled();
      expect(updateMany).not.toHaveBeenCalled();
    });
  });

  describe('lecture initiale', () => {
    it('compte toutes les inscriptions rattachées, sans filtre d’édition ni de statut (CA8)', async () => {
      const { prisma, findUnique } = makePrisma({});
      const useCase = new UpdateEquipeReferentielUseCase(prisma);

      await useCase.execute(7, {});

      expect(findUnique).toHaveBeenCalledWith({
        where: { id: 7 },
        include: { _count: { select: { inscriptions: true } } },
      });
    });
  });

  describe('modification du nom complet (CA4)', () => {
    it('enregistre le nouveau nom complet sans réécrire le nom court', async () => {
      const { prisma, update, updateMany } = makePrisma({});
      const useCase = new UpdateEquipeReferentielUseCase(prisma);

      const equipe = await useCase.execute(7, { nomComplet: 'Coqs de Courbevoie HC' });

      expect(update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { nomComplet: 'Coqs de Courbevoie HC' },
      });
      expect(updateMany).not.toHaveBeenCalled();
      expect(equipe).toBeInstanceOf(EquipeReferentiel);
      expect(equipe.nom).toBe('Courbevoie');
      expect(equipe.nomComplet).toBe('Coqs de Courbevoie HC');
    });

    it('reste possible sur une équipe référencée par des candidatures', async () => {
      const { prisma, update } = makePrisma({ nbInscriptions: 3 });
      const useCase = new UpdateEquipeReferentielUseCase(prisma);

      const equipe = await useCase.execute(7, { nomComplet: 'Coqs HC' });

      expect(update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { nomComplet: 'Coqs HC' },
      });
      expect(equipe.nomComplet).toBe('Coqs HC');
      expect(equipe.nbCandidatures).toBe(3);
    });

    it.each([
      ['null', null],
      ['chaîne vide', ''],
      ['espaces seuls', '   '],
      ['égal au nom court', 'Courbevoie'],
      ['égal au nom court à la casse près', '  COURBEVOIE '],
    ])('efface le nom complet quand il est %s', async (_cas, valeur) => {
      const { prisma, update } = makePrisma({});
      const useCase = new UpdateEquipeReferentielUseCase(prisma);

      const equipe = await useCase.execute(7, { nomComplet: valeur });

      expect(update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { nomComplet: null },
      });
      expect(equipe.nomComplet).toBeNull();
    });

    it('normalise les espaces du nom complet', async () => {
      const { prisma, update } = makePrisma({});
      const useCase = new UpdateEquipeReferentielUseCase(prisma);

      await useCase.execute(7, { nomComplet: '  Les   Coqs  HC ' });

      expect(update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { nomComplet: 'Les Coqs HC' },
      });
    });

    it('ne touche pas au nom complet quand la clé est absente du corps', async () => {
      const { prisma, update, updateMany } = makePrisma({});
      const useCase = new UpdateEquipeReferentielUseCase(prisma);

      const equipe = await useCase.execute(7, {});

      expect(update).not.toHaveBeenCalled();
      expect(updateMany).not.toHaveBeenCalled();
      expect(equipe.nomComplet).toBe('Les Coqs de Courbevoie');
    });
  });

  describe('aucun changement', () => {
    it('n’écrit rien quand les deux valeurs sont identiques à l’existant', async () => {
      const { prisma, update, updateMany } = makePrisma({ nbInscriptions: 2 });
      const useCase = new UpdateEquipeReferentielUseCase(prisma);

      const equipe = await useCase.execute(7, {
        nom: 'Courbevoie',
        nomComplet: 'Les Coqs de Courbevoie',
      });

      expect(update).not.toHaveBeenCalled();
      expect(updateMany).not.toHaveBeenCalled();
      expect(equipe.nom).toBe('Courbevoie');
      expect(equipe.nbCandidatures).toBe(2);
    });

    it('ne considère pas des espaces en trop comme un renommage', async () => {
      const { prisma, update, updateMany } = makePrisma({ nbInscriptions: 1 });
      const useCase = new UpdateEquipeReferentielUseCase(prisma);

      await expect(
        useCase.execute(7, { nom: '  Courbevoie  ' }),
      ).resolves.toBeInstanceOf(EquipeReferentiel);
      expect(update).not.toHaveBeenCalled();
      expect(updateMany).not.toHaveBeenCalled();
    });
  });

  describe('renommage d’une équipe sans candidature (CA5)', () => {
    it('écrit le nom court par une mise à jour conditionnée à l’absence d’inscription', async () => {
      const { prisma, update, updateMany } = makePrisma({});
      const useCase = new UpdateEquipeReferentielUseCase(prisma);

      const equipe = await useCase.execute(7, { nom: 'Courbevoie Coqs' });

      expect(updateMany).toHaveBeenCalledWith({
        where: { id: 7, inscriptions: { none: {} } },
        data: { nom: 'Courbevoie Coqs', nomComplet: 'Les Coqs de Courbevoie' },
      });
      // Le renommage ne passe jamais par l'écriture sans condition.
      expect(update).not.toHaveBeenCalled();
      expect(equipe.nom).toBe('Courbevoie Coqs');
      expect(equipe.nomComplet).toBe('Les Coqs de Courbevoie');
      expect(equipe.nbCandidatures).toBe(0);
    });

    it('normalise les espaces du nouveau nom court', async () => {
      const { prisma, updateMany } = makePrisma({});
      const useCase = new UpdateEquipeReferentielUseCase(prisma);

      await useCase.execute(7, { nom: '  Courbevoie   Coqs ' });

      expect(updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ nom: 'Courbevoie Coqs' }),
        }),
      );
    });

    it('modifie le nom court et le nom complet dans la même écriture', async () => {
      const { prisma, updateMany } = makePrisma({});
      const useCase = new UpdateEquipeReferentielUseCase(prisma);

      const equipe = await useCase.execute(7, {
        nom: 'Rennes',
        nomComplet: 'Les Cormorans de Rennes',
      });

      expect(updateMany).toHaveBeenCalledTimes(1);
      expect(updateMany).toHaveBeenCalledWith({
        where: { id: 7, inscriptions: { none: {} } },
        data: { nom: 'Rennes', nomComplet: 'Les Cormorans de Rennes' },
      });
      expect(equipe.nom).toBe('Rennes');
      expect(equipe.nomComplet).toBe('Les Cormorans de Rennes');
    });

    it('efface le nom complet existant quand le nouveau nom court lui devient égal', async () => {
      const { prisma, updateMany } = makePrisma({});
      const useCase = new UpdateEquipeReferentielUseCase(prisma);

      await useCase.execute(7, { nom: 'Les Coqs de Courbevoie' });

      expect(updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { nom: 'Les Coqs de Courbevoie', nomComplet: null },
        }),
      );
    });

    it.each([
      ['casse', 'COURBEVOIE'],
      ['accent', 'Courbévoie'],
    ])('traite un simple changement de %s comme un renommage', async (_cas, nom) => {
      const { prisma, updateMany } = makePrisma({});
      const useCase = new UpdateEquipeReferentielUseCase(prisma);

      await useCase.execute(7, { nom });

      expect(updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ nom }) }),
      );
    });
  });

  describe('contrôles d’écriture, identiques à la création (CA5)', () => {
    it.each([
      ['vide', ''],
      ['fait d’espaces', '   '],
    ])('refuse un nom court %s', async (_cas, nom) => {
      const { prisma, update, updateMany } = makePrisma({});
      const useCase = new UpdateEquipeReferentielUseCase(prisma);

      const promesse = useCase.execute(7, { nom });

      await expect(promesse).rejects.toThrow(BadRequestException);
      await expect(promesse).rejects.toThrow(MESSAGE_NOM_OBLIGATOIRE);
      expect(update).not.toHaveBeenCalled();
      expect(updateMany).not.toHaveBeenCalled();
    });

    it.each([
      ['le nom court', { nom: `Courbevoie ${RENARD}` }],
      ['le nom complet', { nomComplet: `Les Coqs ${RENARD}` }],
    ])('refuse un emoji dans %s', async (_cas, dto) => {
      const { prisma, update, updateMany } = makePrisma({});
      const useCase = new UpdateEquipeReferentielUseCase(prisma);

      const promesse = useCase.execute(7, dto);

      await expect(promesse).rejects.toThrow(BadRequestException);
      await expect(promesse).rejects.toThrow(MESSAGE_NOM_SANS_EMOJI);
      expect(update).not.toHaveBeenCalled();
      expect(updateMany).not.toHaveBeenCalled();
    });

    it('traduit la violation de l’index unique en 409 « Cette équipe existe déjà »', async () => {
      const { prisma } = makePrisma({ updateManyError: erreurP2002() });
      const useCase = new UpdateEquipeReferentielUseCase(prisma);

      const promesse = useCase.execute(7, { nom: 'Rennes' });

      await expect(promesse).rejects.toThrow(ConflictException);
      await expect(promesse).rejects.toThrow('Cette équipe existe déjà');
    });

    it('laisse remonter telle quelle toute autre erreur de base', async () => {
      const panne = new Error('connexion perdue');
      const { prisma } = makePrisma({ updateManyError: panne });
      const useCase = new UpdateEquipeReferentielUseCase(prisma);

      await expect(useCase.execute(7, { nom: 'Rennes' })).rejects.toBe(panne);
    });
  });

  describe('verrou du nom court (CA7, CA8)', () => {
    it('refuse le renommage en 409 dès qu’une inscription référence l’équipe', async () => {
      const { prisma, update, updateMany } = makePrisma({ nbInscriptions: 1 });
      const useCase = new UpdateEquipeReferentielUseCase(prisma);

      const promesse = useCase.execute(7, { nom: 'Rennes' });

      await expect(promesse).rejects.toThrow(ConflictException);
      await expect(promesse).rejects.toThrow(MESSAGE_NOM_COURT_VERROUILLE);
      expect(update).not.toHaveBeenCalled();
      expect(updateMany).not.toHaveBeenCalled();
    });

    it('ne modifie rien, pas même le nom complet envoyé dans la même requête', async () => {
      const { prisma, update, updateMany } = makePrisma({ nbInscriptions: 2 });
      const useCase = new UpdateEquipeReferentielUseCase(prisma);

      await expect(
        useCase.execute(7, { nom: 'Rennes', nomComplet: 'Les Cormorans' }),
      ).rejects.toThrow(MESSAGE_NOM_COURT_VERROUILLE);
      expect(update).not.toHaveBeenCalled();
      expect(updateMany).not.toHaveBeenCalled();
    });

    it('accepte le même appel quand le nom court est inchangé', async () => {
      const { prisma, update } = makePrisma({ nbInscriptions: 2 });
      const useCase = new UpdateEquipeReferentielUseCase(prisma);

      const equipe = await useCase.execute(7, {
        nom: 'Courbevoie',
        nomComplet: 'Les Cormorans',
      });

      expect(update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { nomComplet: 'Les Cormorans' },
      });
      expect(equipe.nomComplet).toBe('Les Cormorans');
    });

    it.each([
      ['casse', 'courbevoie'],
      ['accent', 'Courbévoie'],
    ])('bloque aussi un simple changement de %s', async (_cas, nom) => {
      const { prisma, updateMany } = makePrisma({ nbInscriptions: 1 });
      const useCase = new UpdateEquipeReferentielUseCase(prisma);

      await expect(useCase.execute(7, { nom })).rejects.toThrow(
        MESSAGE_NOM_COURT_VERROUILLE,
      );
      expect(updateMany).not.toHaveBeenCalled();
    });

    it('refuse en 409 quand une candidature arrive entre la lecture et l’écriture (0 ligne modifiée)', async () => {
      const { prisma, update, findUnique } = makePrisma({
        nbInscriptions: 0,
        updateManyCount: 0,
      });
      const useCase = new UpdateEquipeReferentielUseCase(prisma);

      const promesse = useCase.execute(7, { nom: 'Rennes' });

      await expect(promesse).rejects.toThrow(ConflictException);
      await expect(promesse).rejects.toThrow(MESSAGE_NOM_COURT_VERROUILLE);
      expect(update).not.toHaveBeenCalled();
      // Pas de relecture après un refus : seule la lecture initiale a eu lieu.
      expect(findUnique).toHaveBeenCalledTimes(1);
    });

    it('ne confond pas ce refus avec un doublon', async () => {
      const { prisma } = makePrisma({ updateManyCount: 0 });
      const useCase = new UpdateEquipeReferentielUseCase(prisma);

      await expect(useCase.execute(7, { nom: 'Rennes' })).rejects.not.toThrow(
        'Cette équipe existe déjà',
      );
    });
  });

  describe('équipe disparue pendant l’écriture', () => {
    it('renvoie 404 si la ligne n’existe plus à la relecture qui suit le renommage', async () => {
      const { prisma, findUnique } = makePrisma({});
      const useCase = new UpdateEquipeReferentielUseCase(prisma);
      // Lecture initiale normale, relecture vide.
      const lectureInitiale = findUnique.getMockImplementation()!;
      findUnique
        .mockImplementationOnce(lectureInitiale)
        .mockResolvedValueOnce(null);

      await expect(useCase.execute(7, { nom: 'Rennes' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('champs hors périmètre', () => {
    it('ne modifie jamais logoUrl ni active, même s’ils sont glissés dans le corps', async () => {
      const { prisma, update } = makePrisma({});
      const useCase = new UpdateEquipeReferentielUseCase(prisma);

      await useCase.execute(7, {
        nomComplet: 'Coqs HC',
        logoUrl: 'https://exemple.test/x.png',
        active: false,
      } as never);

      expect(update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { nomComplet: 'Coqs HC' },
      });
    });
  });
});
