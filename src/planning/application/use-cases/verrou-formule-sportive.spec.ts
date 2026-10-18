import { ConflictException } from '@nestjs/common';
import { EditionVerrouService } from '../../../inscription/application/shared/edition-verrou.service';
import { MESSAGE_FORMULE_FIGEE } from '../../../inscription/domain/edition-regles';
import {
  EDITION_ETAPES,
  type EditionEtape,
} from '../../../inscription/domain/enums/edition-etape.enum';
import { dependanceEspionne } from '../../../../test/support/edition-verrou.mock';
import { UpdateParametresSportifsUseCase } from './update-parametres-sportifs.usecase';
import { UpsertJourUseCase } from './upsert-jour.usecase';
import { DeleteJourUseCase } from './delete-jour.usecase';
import { CreerActiviteCatalogueUseCase } from './activite-catalogue/creer-activite-catalogue.usecase';
import { ModifierActiviteCatalogueUseCase } from './activite-catalogue/modifier-activite-catalogue.usecase';
import { SupprimerActiviteCatalogueUseCase } from './activite-catalogue/supprimer-activite-catalogue.usecase';
import { CreerCreneauActiviteUseCase } from './creneau-activite/creer-creneau-activite.usecase';
import { ModifierCreneauActiviteUseCase } from './creneau-activite/modifier-creneau-activite.usecase';
import { SupprimerCreneauActiviteUseCase } from './creneau-activite/supprimer-creneau-activite.usecase';
import { CreerPhaseUseCase } from './format-graphe/creer-phase.usecase';
import { ModifierPhaseUseCase } from './format-graphe/modifier-phase.usecase';
import { SupprimerPhaseUseCase } from './format-graphe/supprimer-phase.usecase';
import { ReordonnerPhasesUseCase } from './format-graphe/reordonner-phases.usecase';
import { CreerGroupeUseCase } from './format-graphe/creer-groupe.usecase';
import { ModifierGroupeUseCase } from './format-graphe/modifier-groupe.usecase';
import { SupprimerGroupeUseCase } from './format-graphe/supprimer-groupe.usecase';
import { AjouterPlaceAliasUseCase } from './format-graphe/ajouter-place-alias.usecase';
import { SupprimerPlaceUseCase } from './format-graphe/supprimer-place.usecase';
import { DefinirLienUseCase } from './format-graphe/definir-lien.usecase';
import { MarquerEliminieUseCase } from './format-graphe/marquer-elimine.usecase';
import { ReinitialiserLienUseCase } from './format-graphe/reinitialiser-lien.usecase';
import { AssocierPhaseJourUseCase } from './format-graphe/associer-phase-jour.usecase';
import { DissocierPhaseJourUseCase } from './format-graphe/dissocier-phase-jour.usecase';
import { GenererPresetUseCase } from './format-graphe/generer-preset.usecase';

/**
 * Matrice étape × use case d'écriture de la formule sportive (spec § 2.3,
 * CA 1, 2 et 6), avec le vrai EditionVerrouService sur une étape simulée.
 * Les dépendances propres de chaque use case sont des espions : à l'étape
 * figée, aucune ne doit être touchée.
 */
const E = 42;

type UseCase = { execute: (...a: any[]) => Promise<unknown> };
type Cas = [string, (deps: any[], verrou: EditionVerrouService) => UseCase, number, unknown[]];

// [route, fabrique, nombre de dépendances avant le verrou, arguments de execute]
const USE_CASES: Cas[] = [
  ['PUT parametres-sportifs/:id', ([a, b], v) => new UpdateParametresSportifsUseCase(a, b, v), 2, [E, { nbPatinoires: 2 }]],
  ['POST parametres-sportifs/:id/jours (+ /:numeroJour)', ([a], v) => new UpsertJourUseCase(a, v), 1, [E, { numeroJour: 1 }]],
  ['DELETE parametres-sportifs/:id/jours/:numeroJour', ([a], v) => new DeleteJourUseCase(a, v), 1, [E, 1]],
  ['POST activites-catalogue', ([a], v) => new CreerActiviteCatalogueUseCase(a, v), 1, [E, { nom: 'Slalom' }]],
  ['PUT activites-catalogue/:id', ([a], v) => new ModifierActiviteCatalogueUseCase(a, v), 1, [3, E, { nom: 'Slalom' }]],
  ['DELETE activites-catalogue/:id', ([a], v) => new SupprimerActiviteCatalogueUseCase(a, v), 1, [3, E]],
  ['POST creneaux-activite', ([a], v) => new CreerCreneauActiviteUseCase(a, v), 1, [E, {}]],
  ['PUT creneaux-activite/:id', ([a], v) => new ModifierCreneauActiviteUseCase(a, v), 1, [3, E, {}]],
  ['DELETE creneaux-activite/:id', ([a], v) => new SupprimerCreneauActiviteUseCase(a, v), 1, [3, E]],
  ['graphe : créer phase', ([a], v) => new CreerPhaseUseCase(a, v), 1, [E, { libelle: 'P' }]],
  ['graphe : modifier phase', ([a], v) => new ModifierPhaseUseCase(a, v), 1, [E, 3, { libelle: 'P' }]],
  ['graphe : supprimer phase', ([a], v) => new SupprimerPhaseUseCase(a, v), 1, [E, 3]],
  ['graphe : réordonner phases', ([a], v) => new ReordonnerPhasesUseCase(a, v), 1, [E, { phaseIds: [3] }]],
  ['graphe : créer groupe', ([a], v) => new CreerGroupeUseCase(a, v), 1, [E, 3, { libelle: 'G' }]],
  ['graphe : modifier groupe', ([a], v) => new ModifierGroupeUseCase(a, v), 1, [E, 3, { libelle: 'G' }]],
  ['graphe : supprimer groupe', ([a], v) => new SupprimerGroupeUseCase(a, v), 1, [E, 3]],
  ['graphe : ajouter place alias', ([a], v) => new AjouterPlaceAliasUseCase(a, v), 1, [E, 3, { alias: 'A1' }]],
  ['graphe : supprimer place', ([a], v) => new SupprimerPlaceUseCase(a, v), 1, [E, 3]],
  ['graphe : définir lien', ([a], v) => new DefinirLienUseCase(a, v), 1, [E, 3, 1, { groupeCibleId: 4 }]],
  ['graphe : marquer éliminé', ([a], v) => new MarquerEliminieUseCase(a, v), 1, [E, 3, 1]],
  ['graphe : réinitialiser lien', ([a], v) => new ReinitialiserLienUseCase(a, v), 1, [E, 3, 1]],
  ['graphe : associer phase/jour', ([a], v) => new AssocierPhaseJourUseCase(a, v), 1, [E, 3, { editionJourId: 5 }]],
  ['graphe : dissocier phase/jour', ([a], v) => new DissocierPhaseJourUseCase(a, v), 1, [E, 3, 5]],
  ['graphe : générer preset', ([a, b], v) => new GenererPresetUseCase(a, b, v), 2, [E, {}]],
];

const MODIFIABLES = EDITION_ETAPES.filter((e) => e !== 'TOURNOI_DEMARRE');

function monter(fabrique: Cas[1], nbDeps: number, etape: EditionEtape) {
  const findUnique = jest.fn().mockResolvedValue({ etape });
  const verrou = new EditionVerrouService({ inscEdition: { findUnique } } as any);
  const espions = Array.from({ length: nbDeps }, () => dependanceEspionne());
  return {
    useCase: fabrique(espions.map((e) => e.dep), verrou),
    appels: () => espions.flatMap((e) => e.appels),
    findUnique,
  };
}

describe('Verrou de la formule sportive par étape', () => {
  it("couvre les 24 use cases d'écriture de la formule", () => {
    expect(USE_CASES).toHaveLength(24);
  });

  describe.each(USE_CASES)('%s', (_route, fabrique, nbDeps, args) => {
    it('409 à TOURNOI_DEMARRE, sans aucune lecture ni écriture', async () => {
      const { useCase, appels, findUnique } = monter(fabrique, nbDeps, 'TOURNOI_DEMARRE');

      const promesse = useCase.execute(...args);

      await expect(promesse).rejects.toBeInstanceOf(ConflictException);
      await expect(promesse).rejects.toThrow(MESSAGE_FORMULE_FIGEE);
      expect(findUnique).toHaveBeenCalledWith({ where: { id: E }, select: { etape: true } });
      expect(appels()).toEqual([]);
    });

    it.each(MODIFIABLES)('passe le garde à %s', async (etape) => {
      const { useCase, findUnique } = monter(fabrique, nbDeps, etape);

      // Les dépendances espionnes ne renvoient rien : le use case peut échouer
      // plus loin (validation, données absentes), mais jamais sur le garde.
      const erreur = await useCase.execute(...args).then(
        () => null,
        (e: unknown) => e,
      );

      expect(findUnique).toHaveBeenCalledWith({ where: { id: E }, select: { etape: true } });
      expect(erreur instanceof ConflictException && erreur.message === MESSAGE_FORMULE_FIGEE).toBe(false);
    });
  });
});
