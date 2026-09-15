import { FormatGrapheValidationService } from './format-graphe-validation.service';
import { FormatGraphe } from '../../domain/entities/format/format-graphe.entity';
import { FormatGroupe } from '../../domain/entities/format/format-groupe.entity';
import { FormatPhase } from '../../domain/entities/format/format-phase.entity';
import { FormatPlace } from '../../domain/entities/format/format-place.entity';
import { FormatLien } from '../../domain/entities/format/format-lien.entity';

function makePlace(overrides: Partial<FormatPlace> = {}): FormatPlace {
  return new FormatPlace(
    overrides.id ?? 1,
    overrides.groupeId ?? 1,
    overrides.position ?? 1,
    overrides.origine ?? 'ALIAS',
    overrides.aliasLabel ?? 'Équipe A',
    overrides.lienEntrantId ?? null,
  );
}

function makeGroupe(overrides: Partial<FormatGroupe> = {}): FormatGroupe {
  return new FormatGroupe(
    overrides.id ?? 1,
    overrides.phaseId ?? 1,
    overrides.nom ?? 'Poule A',
    overrides.ordre ?? 1,
    overrides.places ?? [],
  );
}

function makeLien(overrides: Partial<FormatLien> = {}): FormatLien {
  return new FormatLien(
    overrides.id ?? 1,
    overrides.groupeSourceId ?? 1,
    overrides.rangSource ?? 1,
    overrides.etat ?? 'NON_DEFINI',
    overrides.groupeCibleId ?? null,
    overrides.placeCibleId ?? null,
  );
}

function makeGraphe(overrides: Partial<FormatGraphe> = {}): FormatGraphe {
  return new FormatGraphe(
    overrides.editionId ?? 1,
    overrides.phases ?? [new FormatPhase(1, 1, 'Brassage', 1, [])],
    overrides.groupes ?? [],
    overrides.liens ?? [],
    overrides.modifieManuellement ?? false,
    overrides.genereDepuisPreset ?? null,
  );
}

describe('FormatGrapheValidationService', () => {
  const service = new FormatGrapheValidationService();

  describe('validerPartiel', () => {
    it('valide un graphe vide (aucun groupe créé)', () => {
      expect(service.validerPartiel(makeGraphe())).toEqual({ valide: true });
    });

    it('valide un groupe à 0 place (en cours de construction)', () => {
      const graphe = makeGraphe({ groupes: [makeGroupe({ places: [] })] });
      expect(service.validerPartiel(graphe)).toEqual({ valide: true });
    });

    it('valide un groupe à 2 places', () => {
      const graphe = makeGraphe({
        groupes: [
          makeGroupe({
            places: [makePlace({ id: 1, position: 1 }), makePlace({ id: 2, position: 2 })],
          }),
        ],
      });
      expect(service.validerPartiel(graphe)).toEqual({ valide: true });
    });

    it('valide un groupe à ≥3 places', () => {
      const graphe = makeGraphe({
        groupes: [
          makeGroupe({
            places: [
              makePlace({ id: 1, position: 1 }),
              makePlace({ id: 2, position: 2 }),
              makePlace({ id: 3, position: 3 }),
            ],
          }),
        ],
      });
      expect(service.validerPartiel(graphe)).toEqual({ valide: true });
    });

    it('rejette un groupe à exactement 1 place', () => {
      const graphe = makeGraphe({
        groupes: [makeGroupe({ id: 7, nom: 'Poule X', places: [makePlace({ id: 1 })] })],
      });
      const result = service.validerPartiel(graphe);
      expect(result.valide).toBe(false);
      if (!result.valide) {
        expect(result.erreurs).toEqual([
          'Groupe "Poule X" (id=7) a exactement 1 place — il doit en avoir 0, 2 ou ≥3',
        ]);
      }
    });

    it('tolère des rangs NON_DEFINI restants', () => {
      const graphe = makeGraphe({
        groupes: [
          makeGroupe({
            places: [makePlace({ id: 1, position: 1 }), makePlace({ id: 2, position: 2 })],
          }),
        ],
        liens: [makeLien({ etat: 'NON_DEFINI' })],
      });
      expect(service.validerPartiel(graphe)).toEqual({ valide: true });
    });

    it('accumule une erreur par groupe fautif', () => {
      const graphe = makeGraphe({
        groupes: [
          makeGroupe({ id: 1, nom: 'A', places: [makePlace({ id: 1 })] }),
          makeGroupe({ id: 2, nom: 'B', places: [makePlace({ id: 2 })] }),
        ],
      });
      const result = service.validerPartiel(graphe);
      expect(result.valide).toBe(false);
      if (!result.valide) {
        expect(result.erreurs).toHaveLength(2);
      }
    });
  });

  describe('validerActivable', () => {
    it('valide un graphe entièrement résolu (2 places, rangs LIE/ELIMINE)', () => {
      const graphe = makeGraphe({
        groupes: [
          makeGroupe({
            id: 1,
            places: [makePlace({ id: 1, position: 1 }), makePlace({ id: 2, position: 2 })],
          }),
        ],
        liens: [
          makeLien({ groupeSourceId: 1, rangSource: 1, etat: 'LIE', groupeCibleId: 2 }),
          makeLien({ groupeSourceId: 1, rangSource: 2, etat: 'ELIMINE' }),
        ],
      });
      expect(service.validerActivable(graphe)).toEqual({ valide: true });
    });

    it("rejette un groupe avec moins de 2 places", () => {
      const graphe = makeGraphe({
        groupes: [makeGroupe({ id: 3, nom: 'Vide', places: [] })],
      });
      const result = service.validerActivable(graphe);
      expect(result.valide).toBe(false);
      if (!result.valide) {
        expect(result.erreurs).toEqual([
          'Groupe "Vide" (id=3) a 0 place(s) — minimum 2 requis',
        ]);
      }
    });

    it('rejette tout rang NON_DEFINI restant, avec le nom du groupe concerné', () => {
      const graphe = makeGraphe({
        groupes: [
          makeGroupe({
            id: 5,
            nom: 'Poule A',
            places: [makePlace({ id: 1, position: 1 }), makePlace({ id: 2, position: 2 })],
          }),
        ],
        liens: [makeLien({ groupeSourceId: 5, rangSource: 2, etat: 'NON_DEFINI' })],
      });
      const result = service.validerActivable(graphe);
      expect(result.valide).toBe(false);
      if (!result.valide) {
        expect(result.erreurs).toEqual([
          'Rang 2 du groupe "Poule A" est NON_DEFINI — résolvez-le en ELIMINE ou en lien vers un groupe cible',
        ]);
      }
    });

    it('accumule à la fois les erreurs d\'effectif et de rang NON_DEFINI', () => {
      const graphe = makeGraphe({
        groupes: [makeGroupe({ id: 1, nom: 'Vide', places: [] })],
        liens: [makeLien({ groupeSourceId: 1, rangSource: 1, etat: 'NON_DEFINI' })],
      });
      const result = service.validerActivable(graphe);
      expect(result.valide).toBe(false);
      if (!result.valide) {
        expect(result.erreurs).toHaveLength(2);
      }
    });
  });
});
