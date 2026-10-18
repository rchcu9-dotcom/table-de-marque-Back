import {
  ETAPES_FORMULE_SPORTIVE_MODIFIABLE,
  ETAPES_PARAMETRES_INSCRIPTION_MODIFIABLES,
  formuleSportiveModifiable,
  parametresInscriptionModifiables,
} from './edition-regles';
import { EDITION_ETAPES, type EditionEtape } from './enums/edition-etape.enum';

const MATRICE: ReadonlyArray<[EditionEtape, boolean, boolean]> = [
  // étape, paramètres d'inscription modifiables, formule sportive modifiable
  ['CREEE', true, true],
  ['CREATION_NOUVEAU_TOURNOI', true, true],
  ['INSCRIPTIONS_OUVERTES', false, true],
  ['CLOTUREE', false, true],
  ['TOURNOI_DEMARRE', false, false],
];

describe('edition-regles', () => {
  it('couvre toutes les étapes', () => {
    expect(MATRICE.map(([e]) => e).sort()).toEqual([...EDITION_ETAPES].sort());
  });

  it.each(MATRICE)(
    '%s : inscription modifiable = %s, formule modifiable = %s',
    (etape, inscription, formule) => {
      expect(parametresInscriptionModifiables(etape)).toBe(inscription);
      expect(formuleSportiveModifiable(etape)).toBe(formule);
    },
  );

  it("les paramètres d'inscription ne sont jamais modifiables quand la formule ne l'est plus", () => {
    for (const etape of ETAPES_PARAMETRES_INSCRIPTION_MODIFIABLES) {
      expect(ETAPES_FORMULE_SPORTIVE_MODIFIABLE).toContain(etape);
    }
  });

  it('refuse une étape inconnue', () => {
    expect(parametresInscriptionModifiables('INCONNUE' as EditionEtape)).toBe(false);
    expect(formuleSportiveModifiable('INCONNUE' as EditionEtape)).toBe(false);
  });
});
