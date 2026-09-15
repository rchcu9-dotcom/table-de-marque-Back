import { GenerationMatchsGrapheService } from './generation-matchs-graphe.service';
import { NumeroMatchAllocator } from './numero-match-allocator';
import { FormatGraphe } from '../../domain/entities/format/format-graphe.entity';
import { FormatGroupe } from '../../domain/entities/format/format-groupe.entity';
import { FormatPhase } from '../../domain/entities/format/format-phase.entity';
import { FormatPlace } from '../../domain/entities/format/format-place.entity';
import { FormatLien } from '../../domain/entities/format/format-lien.entity';
import { EquipeSimulation } from '../../domain/entities/equipe-simulation.entity';
import { InscEditionJour } from '../../domain/entities/inscription-edition-jour.entity';
import { FormatGroupeFormule } from '../../domain/enums/format-groupe-formule.enum';

function makeJour(overrides: Partial<InscEditionJour> = {}): InscEditionJour {
  return new InscEditionJour(
    overrides.id ?? 1,
    overrides.editionId ?? 1,
    overrides.numeroJour ?? 1,
    overrides.date ?? new Date('2027-05-22T00:00:00.000Z'),
    overrides.heureDebut ?? new Date('2027-05-22T09:00:00.000Z'),
    overrides.heureFin ?? new Date('2027-05-22T21:00:00.000Z'),
    overrides.typeJournee ?? '5V5',
  );
}

function makeEquipe(ref: string, nom: string): EquipeSimulation {
  return new EquipeSimulation(ref, nom, false, Number(ref.replace(/\D/g, '')));
}

describe('GenerationMatchsGrapheService', () => {
  const service = new GenerationMatchsGrapheService();
  const allocatorInput = () => new NumeroMatchAllocator(0, 100);

  function baseInput(overrides: {
    graphe: FormatGraphe;
    equipes: EquipeSimulation[];
    joursParPhase: Map<number, InscEditionJour[]>;
  }) {
    return {
      ...overrides,
      dureeMatchPouleMin: 20,
      dureeMatchFinalMin: 25,
      dureeSurfacageMin: 5,
      dureeInterMatchMin: 0,
      nbPatinoires: 2,
      allocator: allocatorInput(),
    };
  }

  it('génère un round-robin complet pour un Groupe CHAMPIONNAT (≥3 places) et propage le rang 1 vers le Groupe cible', () => {
    const phase1 = new FormatPhase(1, 1, 'Brassage', 1, []);
    const phase2 = new FormatPhase(2, 1, 'Finale', 2, []);
    const placesPoule = [
      new FormatPlace(1, 10, 1, 'ALIAS', 'Équipe A', null),
      new FormatPlace(2, 10, 2, 'ALIAS', 'Équipe B', null),
      new FormatPlace(3, 10, 3, 'ALIAS', 'Équipe C', null),
    ];
    const groupePoule = new FormatGroupe(10, 1, 'Poule A', 1, placesPoule);
    const placeFinale = new FormatPlace(4, 20, 1, 'LIEE', null, 100);
    const groupeFinale = new FormatGroupe(20, 2, 'Finale', 1, [placeFinale]);
    const lien = new FormatLien(100, 10, 1, 'LIE', 20, 4);

    const graphe = new FormatGraphe(
      1,
      [phase1, phase2],
      [groupePoule, groupeFinale],
      [lien],
      false,
      null,
    );

    const equipes = [
      makeEquipe('real:1', 'Aigles'),
      makeEquipe('real:2', 'Loups'),
      makeEquipe('real:3', 'Ours'),
    ];

    const jour = makeJour({ numeroJour: 1 });
    const output = service.genere(
      baseInput({
        graphe,
        equipes,
        joursParPhase: new Map([[1, [jour]]]),
      }),
    );

    // Round-robin à 3 équipes = 3 matchs (A-B, A-C, B-C)
    const matchsPoule = output.matches.filter((m) => m.groupeId === 10);
    expect(matchsPoule).toHaveLength(3);
    expect(matchsPoule.every((m) => m.poule === 'A')).toBe(true);
    expect(output.poules.get('A')).toEqual(['real:1', 'real:2', 'real:3']);

    // Le rang 1 du groupe poule est proposé comme qualifié vers la finale
    expect(output.qualifies).toEqual([
      expect.objectContaining({
        ref: 'placeholder:groupe-10-rang-1',
        poule: 'A',
        rang: 1,
      }),
    ]);
  });

  it('génère un match unique pour un Groupe MATCH_UNIQUE (2 places) sans round-robin', () => {
    const phase1 = new FormatPhase(1, 1, 'Demi-finale', 1, []);
    const places = [
      new FormatPlace(1, 10, 1, 'ALIAS', 'Équipe A', null),
      new FormatPlace(2, 10, 2, 'ALIAS', 'Équipe B', null),
    ];
    const groupe = new FormatGroupe(10, 1, 'Demi 1', 1, places);
    const graphe = new FormatGraphe(1, [phase1], [groupe], [], false, null);

    const equipes = [makeEquipe('real:1', 'Aigles'), makeEquipe('real:2', 'Loups')];
    const jour = makeJour({ numeroJour: 1 });

    const output = service.genere(
      baseInput({ graphe, equipes, joursParPhase: new Map([[1, [jour]]]) }),
    );

    expect(output.matches).toHaveLength(1);
    expect(output.matches[0].poule).toBeNull();
    expect(output.matches[0].groupeId).toBe(10);
  });

  it("propage le vainqueur (rang 1) ET le perdant (rang 2) d'un Groupe MATCH_UNIQUE vers des Groupes cibles distincts (tableau haute/basse)", () => {
    const phase1 = new FormatPhase(1, 1, 'Demi-finale', 1, []);
    const phase2 = new FormatPhase(2, 1, 'Finale/Petite finale', 2, []);

    const placesDemi = [
      new FormatPlace(1, 10, 1, 'ALIAS', 'Équipe A', null),
      new FormatPlace(2, 10, 2, 'ALIAS', 'Équipe B', null),
    ];
    const groupeDemi = new FormatGroupe(10, 1, 'Demi 1', 1, placesDemi);

    const placeFinale = new FormatPlace(3, 20, 1, 'LIEE', null, 200);
    const groupeFinale = new FormatGroupe(20, 2, 'Finale', 1, [placeFinale]);
    const placePetiteFinale = new FormatPlace(4, 21, 1, 'LIEE', null, 201);
    const groupePetiteFinale = new FormatGroupe(21, 2, 'Petite finale', 2, [
      placePetiteFinale,
    ]);

    const lienVainqueur = new FormatLien(200, 10, 1, 'LIE', 20, 3);
    const lienPerdant = new FormatLien(201, 10, 2, 'LIE', 21, 4);

    const graphe = new FormatGraphe(
      1,
      [phase1, phase2],
      [groupeDemi, groupeFinale, groupePetiteFinale],
      [lienVainqueur, lienPerdant],
      false,
      null,
    );

    const equipes = [makeEquipe('real:1', 'Aigles'), makeEquipe('real:2', 'Loups')];
    const jour = makeJour({ numeroJour: 1 });

    const output = service.genere(
      baseInput({ graphe, equipes, joursParPhase: new Map([[1, [jour]]]) }),
    );

    const matchDemi = output.matches.find((m) => m.groupeId === 10)!;
    expect(matchDemi.refVainqueurProduit).toBe('placeholder:groupe-10-rang-1');
    expect(matchDemi.refPerdantProduit).toBe('placeholder:groupe-10-rang-2');
  });

  it('déduit la mécanique CHAMPIONNAT pour un groupe à 4 places (pas de bracket imbriqué)', () => {
    const phase1 = new FormatPhase(1, 1, 'Poule', 1, []);
    const places = [1, 2, 3, 4].map(
      (n) => new FormatPlace(n, 10, n, 'ALIAS', `Équipe ${n}`, null),
    );
    const groupe = new FormatGroupe(10, 1, 'Poule A', 1, places);
    const graphe = new FormatGraphe(1, [phase1], [groupe], [], false, null);

    const equipes = [1, 2, 3, 4].map((n) => makeEquipe(`real:${n}`, `Équipe ${n}`));
    const jour = makeJour({ numeroJour: 1 });

    const output = service.genere(
      baseInput({ graphe, equipes, joursParPhase: new Map([[1, [jour]]]) }),
    );

    // Round-robin à 4 équipes = 6 matchs
    expect(output.matches).toHaveLength(6);
  });

  it('bloque explicitement la génération pour un Groupe configuré en RONDE_SUISSE (CA5), sans générer de match erroné', () => {
    const phase1 = new FormatPhase(1, 1, 'Poule', 1, []);
    const places = [1, 2, 3].map(
      (n) => new FormatPlace(n, 10, n, 'ALIAS', `Équipe ${n}`, null),
    );
    const groupe = new FormatGroupe(
      10,
      1,
      'Poule Ronde Suisse',
      1,
      places,
      FormatGroupeFormule.RONDE_SUISSE,
    );
    const graphe = new FormatGraphe(1, [phase1], [groupe], [], false, null);

    const equipes = [1, 2, 3].map((n) => makeEquipe(`real:${n}`, `Équipe ${n}`));
    const jour = makeJour({ numeroJour: 1 });

    expect(() =>
      service.genere(
        baseInput({ graphe, equipes, joursParPhase: new Map([[1, [jour]]]) }),
      ),
    ).toThrow(/Ronde suisse/);
    expect(() =>
      service.genere(
        baseInput({ graphe, equipes, joursParPhase: new Map([[1, [jour]]]) }),
      ),
    ).toThrow(/Poule Ronde Suisse/);
  });

  it('ne génère aucun match pour un Groupe dont moins de 2 équipes sont affectées', () => {
    const phase1 = new FormatPhase(1, 1, 'Poule', 1, []);
    const places = [new FormatPlace(1, 10, 1, 'ALIAS', 'Équipe A', null)];
    const groupe = new FormatGroupe(10, 1, 'Poule A', 1, places);
    const graphe = new FormatGraphe(1, [phase1], [groupe], [], false, null);

    const output = service.genere(
      baseInput({
        graphe,
        equipes: [makeEquipe('real:1', 'Aigles')],
        joursParPhase: new Map(),
      }),
    );

    expect(output.matches).toHaveLength(0);
  });
});
