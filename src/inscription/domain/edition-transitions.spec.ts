import {
  TRANSITIONS_ETAPE,
  estTransitionAutorisee,
} from './edition-transitions';
import {
  EDITION_ETAPES,
  type EditionEtape,
} from './enums/edition-etape.enum';

const AUTORISEES: ReadonlyArray<[EditionEtape, EditionEtape]> = [
  ['CREEE', 'INSCRIPTIONS_OUVERTES'],
  ['CREATION_NOUVEAU_TOURNOI', 'INSCRIPTIONS_OUVERTES'],
  ['INSCRIPTIONS_OUVERTES', 'CLOTUREE'],
  // Retour en Préparation (RevenirEnPreparationUseCase porte ses conditions).
  ['INSCRIPTIONS_OUVERTES', 'CREEE'],
  ['INSCRIPTIONS_OUVERTES', 'CREATION_NOUVEAU_TOURNOI'],
  ['CLOTUREE', 'INSCRIPTIONS_OUVERTES'],
  ['CLOTUREE', 'TOURNOI_DEMARRE'],
];

describe('edition-transitions', () => {
  it('définit une entrée pour chaque étape', () => {
    expect(Object.keys(TRANSITIONS_ETAPE).sort()).toEqual(
      [...EDITION_ETAPES].sort(),
    );
  });

  it.each(AUTORISEES)('autorise %s → %s', (from, to) => {
    expect(estTransitionAutorisee(from, to)).toBe(true);
  });

  // Chaque couple (départ, arrivée) hors table est refusé — y compris les
  // transitions « no-op » (ouvrir une édition déjà ouverte, etc.).
  const INTERDITES = EDITION_ETAPES.flatMap((from) =>
    EDITION_ETAPES.map((to) => [from, to] as [EditionEtape, EditionEtape]),
  ).filter(([from, to]) => !AUTORISEES.some(([f, t]) => f === from && t === to));

  it.each(INTERDITES)('refuse %s → %s', (from, to) => {
    expect(estTransitionAutorisee(from, to)).toBe(false);
  });

  it('ne permet de revenir vers CREEE / CREATION_NOUVEAU_TOURNOI que depuis INSCRIPTIONS_OUVERTES', () => {
    for (const from of EDITION_ETAPES) {
      const attendu = from === 'INSCRIPTIONS_OUVERTES';
      expect(estTransitionAutorisee(from, 'CREEE')).toBe(attendu);
      expect(estTransitionAutorisee(from, 'CREATION_NOUVEAU_TOURNOI')).toBe(attendu);
    }
  });

  it('TOURNOI_DEMARRE est terminal', () => {
    expect(TRANSITIONS_ETAPE.TOURNOI_DEMARRE).toEqual([]);
  });

  it('retourne false pour une étape de départ inconnue', () => {
    expect(
      estTransitionAutorisee('INCONNUE' as EditionEtape, 'CLOTUREE'),
    ).toBe(false);
  });
});
