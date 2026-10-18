import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InscriptionStatut } from '@prisma/client';
import { DossierAccessService } from '@/inscription/application/dossier/dossier-access.service';
import { AjouterJoueurUseCase } from '@/inscription/application/dossier/ajouter-joueur.usecase';
import { ModifierJoueurUseCase } from '@/inscription/application/dossier/modifier-joueur.usecase';
import { SupprimerJoueurUseCase } from '@/inscription/application/dossier/supprimer-joueur.usecase';
import { AjouterCoachUseCase } from '@/inscription/application/dossier/ajouter-coach.usecase';
import { ModifierCoachUseCase } from '@/inscription/application/dossier/modifier-coach.usecase';
import { SupprimerCoachUseCase } from '@/inscription/application/dossier/supprimer-coach.usecase';
import { AccepterDroitsImageUseCase } from '@/inscription/application/dossier/accepter-droits-image.usecase';
import {
  organisateur,
  referent,
  type DossierActeur,
} from '@/inscription/application/dossier/dossier-acteur';
import type { AnneeAgeValidationService } from '@/inscription/application/dossier/annee-age-validation.service';
import type { EditionResolverService } from '@/inscription/application/shared/edition-resolver.service';
import type { InscriptionPrismaService } from '@/inscription/infrastructure/persistence/inscription-prisma.service';

/**
 * Règle de verrouillage validée (backlog 2, lot B) — vérifiée de bout en bout
 * à travers le vrai DossierAccessService et les vrais use cases, Prisma étant
 * simulé en mémoire :
 *
 * | Statut           | Référent       | Organisateur                    |
 * |------------------|----------------|---------------------------------|
 * | VALIDEE          | modifie        | modifie                         |
 * | DOSSIER_EN_COURS | modifie        | modifie                         |
 * | DOSSIER_COMPLET  | lecture seule  | modifie, sans changer le statut |
 * | TOURNOI_DEMARRE  | lecture seule  | lecture seule                   |
 */

const CANDIDATURE_ID = 7;
const DOSSIER_ID = 5;
const MSG_COMPLET =
  "Le dossier est validé et ne peut plus être modifié. Contactez l'organisateur pour le rouvrir.";
const MSG_DEMARRE = 'Le tournoi a démarré, les dossiers ne sont plus modifiables.';

function setup(statut: InscriptionStatut, etape = 'CLOTUREE') {
  const inscription = {
    id: CANDIDATURE_ID,
    editionId: 1,
    utilisateurId: 42,
    statut,
    createdAt: new Date(),
  };
  const joueurRow = {
    id: 3,
    dossierId: DOSSIER_ID,
    dossier: { inscriptionId: CANDIDATURE_ID },
    nom: 'Gretzky',
    prenom: 'Wayne',
    numero: 99,
    poste: 'A',
    licenceFFH: null,
    anneeNaissance: 2015,
    particularitesAlim: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const coachRow = {
    id: 4,
    dossierId: DOSSIER_ID,
    dossier: { inscriptionId: CANDIDATURE_ID },
    nom: 'Bowman',
    prenom: 'Scotty',
    presenceRepas: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const dossierRow = {
    id: DOSSIER_ID,
    inscriptionId: CANDIDATURE_ID,
    droitsImageAcceptes: true,
    droitsImageHorodatage: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const prisma = {
    inscUtilisateur: {
      findUnique: jest.fn().mockResolvedValue({ id: 42, providerUid: 'ref-uid' }),
    },
    inscInscription: {
      findFirst: jest.fn().mockResolvedValue(inscription),
      findUnique: jest.fn(({ where }: { where: { id: number } }) =>
        Promise.resolve(where.id === CANDIDATURE_ID ? inscription : null),
      ),
      update: jest.fn().mockResolvedValue(inscription),
    },
    inscDossier: {
      upsert: jest.fn().mockResolvedValue(dossierRow),
      update: jest.fn().mockResolvedValue(dossierRow),
    },
    inscJoueurDossier: {
      create: jest.fn().mockResolvedValue(joueurRow),
      findUnique: jest.fn().mockResolvedValue(joueurRow),
      update: jest.fn().mockResolvedValue(joueurRow),
      delete: jest.fn().mockResolvedValue(joueurRow),
    },
    inscCoachDossier: {
      create: jest.fn().mockResolvedValue(coachRow),
      findUnique: jest.fn().mockResolvedValue(coachRow),
      update: jest.fn().mockResolvedValue(coachRow),
      delete: jest.fn().mockResolvedValue(coachRow),
    },
  };
  const editionResolver = {
    getEditionActive: jest.fn().mockResolvedValue({ etape }),
  } as unknown as EditionResolverService;
  const anneeAge = {
    assertAnneeAgeValide: jest.fn().mockResolvedValue(undefined),
  } as unknown as AnneeAgeValidationService;

  const p = prisma as unknown as InscriptionPrismaService;
  const access = new DossierAccessService(p, editionResolver);

  const joueur = { nom: 'Gretzky', prenom: 'Wayne', numero: 99, poste: 'A' as const, anneeNaissance: 2015 };
  const coach = { nom: 'Bowman', prenom: 'Scotty' };

  const operations: Record<string, (a: DossierActeur) => Promise<unknown>> = {
    'ajouter un joueur': (a) => new AjouterJoueurUseCase(p, access, anneeAge).execute(a, joueur),
    'modifier un joueur': (a) => new ModifierJoueurUseCase(p, access, anneeAge).execute(a, 3, { nom: 'Lemieux' }),
    'supprimer un joueur': (a) => new SupprimerJoueurUseCase(p, access).execute(a, 3),
    'ajouter un coach': (a) => new AjouterCoachUseCase(p, access).execute(a, coach),
    'modifier un coach': (a) => new ModifierCoachUseCase(p, access).execute(a, 4, { presenceRepas: true }),
    'supprimer un coach': (a) => new SupprimerCoachUseCase(p, access).execute(a, 4),
    "modifier les droits à l'image": (a) => new AccepterDroitsImageUseCase(p, access).execute(a, { accepte: true }),
  };

  const ecritures = () =>
    prisma.inscJoueurDossier.create.mock.calls.length +
    prisma.inscJoueurDossier.update.mock.calls.length +
    prisma.inscJoueurDossier.delete.mock.calls.length +
    prisma.inscCoachDossier.create.mock.calls.length +
    prisma.inscCoachDossier.update.mock.calls.length +
    prisma.inscCoachDossier.delete.mock.calls.length +
    prisma.inscDossier.update.mock.calls.length;

  return { prisma, operations, ecritures };
}

const OPERATIONS = [
  'ajouter un joueur',
  'modifier un joueur',
  'supprimer un joueur',
  'ajouter un coach',
  'modifier un coach',
  'supprimer un coach',
  "modifier les droits à l'image",
];
const ACTEURS: Array<[string, DossierActeur]> = [
  ['référent', referent('ref-uid')],
  ['organisateur', organisateur(CANDIDATURE_ID)],
];

describe('Verrouillage du dossier selon le rôle et le statut', () => {
  describe.each(OPERATIONS)('%s', (operation) => {
    it.each(ACTEURS)(
      '%s : autorisé en DOSSIER_EN_COURS, sans changement de statut',
      async (_nom, acteur) => {
        const { prisma, operations, ecritures } = setup(InscriptionStatut.DOSSIER_EN_COURS);

        await expect(operations[operation](acteur)).resolves.not.toThrow();

        expect(ecritures()).toBe(1);
        expect(prisma.inscInscription.update).not.toHaveBeenCalled();
      },
    );

    it.each(ACTEURS)('%s : refusé à partir de TOURNOI_DEMARRE, même en DOSSIER_EN_COURS', async (_nom, acteur) => {
      const { operations, ecritures } = setup(InscriptionStatut.DOSSIER_EN_COURS, 'TOURNOI_DEMARRE');

      await expect(operations[operation](acteur)).rejects.toThrow(MSG_DEMARRE);
      expect(ecritures()).toBe(0);
    });

    it.each(ACTEURS)('%s : refusé à partir de TOURNOI_DEMARRE en DOSSIER_COMPLET', async (_nom, acteur) => {
      const { operations, ecritures } = setup(InscriptionStatut.DOSSIER_COMPLET, 'TOURNOI_DEMARRE');

      await expect(operations[operation](acteur)).rejects.toThrow(MSG_DEMARRE);
      expect(ecritures()).toBe(0);
    });

    it('référent : refusé en DOSSIER_COMPLET avec le message existant', async () => {
      const { operations, ecritures } = setup(InscriptionStatut.DOSSIER_COMPLET);

      await expect(operations[operation](referent('ref-uid'))).rejects.toThrow(MSG_COMPLET);
      expect(ecritures()).toBe(0);
    });

    it('organisateur : autorisé en DOSSIER_COMPLET, et le statut ne change pas', async () => {
      const { prisma, operations, ecritures } = setup(InscriptionStatut.DOSSIER_COMPLET);

      await operations[operation](organisateur(CANDIDATURE_ID));

      expect(ecritures()).toBe(1);
      expect(prisma.inscInscription.update).not.toHaveBeenCalled();
    });
  });

  describe.each(['ajouter un joueur', 'ajouter un coach', "modifier les droits à l'image"])(
    '%s en VALIDEE',
    (operation) => {
      it.each(ACTEURS)('%s : autorisé et fait passer VALIDEE -> DOSSIER_EN_COURS', async (_nom, acteur) => {
        const { prisma, operations, ecritures } = setup(InscriptionStatut.VALIDEE);

        await operations[operation](acteur);

        expect(ecritures()).toBe(1);
        expect(prisma.inscInscription.update).toHaveBeenCalledWith({
          where: { id: CANDIDATURE_ID },
          data: { statut: InscriptionStatut.DOSSIER_EN_COURS },
        });
      });
    },
  );

  describe('résolution de la candidature par l’organisateur', () => {
    it('renvoie 404 quand la candidature n’existe pas', async () => {
      const { operations, ecritures } = setup(InscriptionStatut.DOSSIER_EN_COURS);

      await expect(operations['ajouter un coach'](organisateur(999))).rejects.toThrow(NotFoundException);
      expect(ecritures()).toBe(0);
    });

    it.each([
      InscriptionStatut.CANDIDATE,
      InscriptionStatut.PAIEMENT_ATTENDU,
      InscriptionStatut.LISTE_ATTENTE,
      InscriptionStatut.REFUSEE,
    ])('refuse l’écriture sur une candidature %s (dossier pas encore accessible)', async (statut) => {
      const { operations, ecritures } = setup(statut);

      await expect(operations['ajouter un coach'](organisateur(CANDIDATURE_ID))).rejects.toThrow(
        BadRequestException,
      );
      expect(ecritures()).toBe(0);
    });

    it('refuse de modifier un joueur qui appartient à une autre candidature', async () => {
      const { prisma, operations } = setup(InscriptionStatut.DOSSIER_COMPLET);
      prisma.inscJoueurDossier.findUnique.mockResolvedValue({ id: 3, dossier: { inscriptionId: 8 } });

      await expect(operations['modifier un joueur'](organisateur(CANDIDATURE_ID))).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.inscJoueurDossier.update).not.toHaveBeenCalled();
    });
  });
});
