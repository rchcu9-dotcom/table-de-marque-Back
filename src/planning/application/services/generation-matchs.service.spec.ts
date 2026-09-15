import { GenerationMatchsService } from './generation-matchs.service';
import { NumeroMatchAllocator } from './numero-match-allocator';
import { FormatPhaseFinale } from '../../domain/enums/format-phase-finale.enum';
import { makeEquipesReelles, makeJour, makeMatchGenere } from './__fixtures__/planning.fixtures';

function baseInput(overrides: Partial<Parameters<GenerationMatchsService['genere']>[0]> = {}) {
  return {
    equipes: makeEquipesReelles(4),
    jours: [makeJour({ numeroJour: 1 })],
    nbPoules: 2,
    nbEquipesQualifieesParPoule: 2,
    formatPhaseFinale: FormatPhaseFinale.ELIMINATION_DIRECTE,
    dureeMatchPouleMin: 27,
    dureeMatchFinalMin: 33,
    dureeSurfacageMin: 5,
    dureeInterMatchMin: 0,
    nbPatinoires: 2,
    allocator: new NumeroMatchAllocator(0, 100),
    ...overrides,
  };
}

describe('GenerationMatchsService', () => {
  let service: GenerationMatchsService;

  beforeEach(() => {
    service = new GenerationMatchsService();
  });

  describe('répartition en poules', () => {
    it('répartit 4 équipes en 2 poules équilibrées (snake)', () => {
      const { poules } = service.genere(baseInput());
      expect(poules.get('A')).toEqual(['real:1', 'real:4']);
      expect(poules.get('B')).toEqual(['real:2', 'real:3']);
    });
  });

  describe('brassage (jour 1) — round-robin par poule', () => {
    it('génère un match par poule (round-robin sur 2 équipes)', () => {
      const { matches } = service.genere(baseInput({ jours: [makeJour({ numeroJour: 1 })] }));

      const brassage = matches.filter((m) => m.phase === 'BRASSAGE');
      expect(brassage).toHaveLength(2);
      expect(brassage.map((m) => [m.equipe1Ref, m.equipe2Ref])).toEqual([
        ['real:1', 'real:4'],
        ['real:2', 'real:3'],
      ]);
    });

    it('attribue le bon code de poule à chaque match', () => {
      const { matches } = service.genere(baseInput());
      const brassage = matches.filter((m) => m.phase === 'BRASSAGE');
      expect(brassage.find((m) => m.equipe1Ref === 'real:1')?.poule).toBe('A');
      expect(brassage.find((m) => m.equipe1Ref === 'real:2')?.poule).toBe('B');
    });

    it('utilise dureeMatchPouleMin comme durée de match', () => {
      const { matches } = service.genere(baseInput());
      expect(matches.every((m) => m.phase !== 'BRASSAGE' || m.dureeMin === 27)).toBe(true);
    });

    it('alloue des numéros de match 5v5 séquentiels à partir de la base fournie', () => {
      const { matches } = service.genere(
        baseInput({ jours: [makeJour({ numeroJour: 1 })], allocator: new NumeroMatchAllocator(50, 100) }),
      );
      const brassage = matches.filter((m) => m.phase === 'BRASSAGE');
      expect(brassage.map((m) => m.numMatch)).toEqual([51, 52]);
      expect(brassage.every((m) => !m.is3v3)).toBe(true);
    });

    it('marque les matchs en 3v3 quand le jour est configuré en 3V3', () => {
      const { matches } = service.genere(
        baseInput({
          jours: [makeJour({ numeroJour: 1, typeJournee: '3V3' })],
          allocator: new NumeroMatchAllocator(0, 100),
        }),
      );
      expect(matches.every((m) => m.is3v3)).toBe(true);
      expect(matches.every((m) => m.numMatch > 100)).toBe(true);
    });

    it("ne génère aucun match si aucun jour n'est fourni", () => {
      const { matches } = service.genere(baseInput({ jours: [] }));
      expect(matches).toHaveLength(0);
    });
  });

  describe('phase finale — absente sans jour suivant ou sans assez de qualifiés', () => {
    it("ne génère pas de phase finale s'il n'y a qu'un seul jour configuré", () => {
      const { matches } = service.genere(baseInput({ jours: [makeJour({ numeroJour: 1 })] }));
      expect(matches.every((m) => m.phase === 'BRASSAGE')).toBe(true);
    });

    it("ne génère pas de phase finale si moins de 2 qualifiés au total", () => {
      const { matches } = service.genere(
        baseInput({
          equipes: makeEquipesReelles(2),
          nbPoules: 1,
          nbEquipesQualifieesParPoule: 1,
          jours: [makeJour({ numeroJour: 1 }), makeJour({ numeroJour: 2 })],
        }),
      );
      expect(matches.every((m) => m.phase === 'BRASSAGE')).toBe(true);
    });
  });

  describe('phase finale — ELIMINATION_DIRECTE', () => {
    function genereEliminationDirecte() {
      return service.genere(
        baseInput({
          formatPhaseFinale: FormatPhaseFinale.ELIMINATION_DIRECTE,
          jours: [
            makeJour({ numeroJour: 1 }),
            makeJour({ numeroJour: 2 }),
            makeJour({ numeroJour: 3 }),
          ],
        }),
      );
    }

    it('génère 2 demi-finales sur le 2e jour puis 1 finale sur le 3e', () => {
      const { matches } = genereEliminationDirecte();
      const finale = matches.filter((m) => m.phase === 'FINALE');
      expect(finale).toHaveLength(3);

      const jour2 = finale.filter((m) => m.jour === 2);
      const jour3 = finale.filter((m) => m.jour === 3);
      expect(jour2).toHaveLength(2);
      expect(jour3).toHaveLength(1);
    });

    it('oppose les qualifiés de rang différent en croisé pour les demi-finales', () => {
      const { matches } = genereEliminationDirecte();
      const demies = matches.filter((m) => m.phase === 'FINALE' && m.jour === 2);
      expect(demies.map((m) => [m.equipe1Nom, m.equipe2Nom])).toEqual([
        ['1er Poule A', '1er Poule B'],
        ['2e Poule A', '2e Poule B'],
      ]);
    });

    it('la finale oppose les libellés "Vainqueur" des deux demi-finales', () => {
      const { matches } = genereEliminationDirecte();
      const finale = matches.find((m) => m.phase === 'FINALE' && m.jour === 3)!;
      expect(finale.equipe1Nom).toContain('Vainqueur');
      expect(finale.equipe2Nom).toContain('Vainqueur');
    });

    it('utilise dureeMatchFinalMin pour les matchs de phase finale', () => {
      const { matches } = genereEliminationDirecte();
      expect(matches.filter((m) => m.phase === 'FINALE').every((m) => m.dureeMin === 33)).toBe(true);
    });

    // Couvre la spec "lors-du-déroulement-live-du-tournoi..." §2 : sans
    // refVainqueurProduit, la résolution automatique de placeholder de
    // bracket n'a aucun moyen de relier un slot à son match source.
    it('ne renseigne jamais refVainqueurProduit pour les matchs de brassage', () => {
      const { matches } = genereEliminationDirecte();
      const brassage = matches.filter((m) => m.phase === 'BRASSAGE');
      expect(brassage.every((m) => m.refVainqueurProduit === null)).toBe(true);
    });

    it('renseigne refVainqueurProduit pour chaque match de bracket (demi-finales et finale)', () => {
      const { matches } = genereEliminationDirecte();
      const finale = matches.filter((m) => m.phase === 'FINALE');
      expect(finale.every((m) => typeof m.refVainqueurProduit === 'string')).toBe(true);
      expect(
        finale.every((m) => m.refVainqueurProduit?.startsWith('placeholder:vainqueur-')),
      ).toBe(true);
    });

    it('le refVainqueurProduit des demi-finales correspond exactement aux refs consommées par le match de finale suivant', () => {
      const { matches } = genereEliminationDirecte();
      const demies = matches.filter((m) => m.phase === 'FINALE' && m.jour === 2);
      const finale = matches.find((m) => m.phase === 'FINALE' && m.jour === 3)!;

      const refsProduitsParDemies = demies.map((m) => m.refVainqueurProduit).sort();
      const refsConsommesParFinale = [finale.equipe1Ref, finale.equipe2Ref].sort();
      expect(refsProduitsParDemies).toEqual(refsConsommesParFinale);
    });
  });

  describe('phase finale — POULES_FINALES', () => {
    it('regroupe les qualifiés par rang en nouvelles poules et les oppose en round-robin', () => {
      const { matches } = service.genere(
        baseInput({
          formatPhaseFinale: FormatPhaseFinale.POULES_FINALES,
          jours: [
            makeJour({ numeroJour: 1 }),
            makeJour({ numeroJour: 2 }),
            makeJour({ numeroJour: 3 }),
          ],
        }),
      );
      const qualif = matches.filter((m) => m.phase === 'QUALIFICATION');
      expect(qualif).toHaveLength(2);
      expect(qualif.map((m) => [m.equipe1Nom, m.equipe2Nom])).toEqual([
        ['1er Poule A', '1er Poule B'],
        ['2e Poule A', '2e Poule B'],
      ]);
    });

    it("ne renseigne jamais refVainqueurProduit (pas de confrontation chaînée dans ce format)", () => {
      const { matches } = service.genere(
        baseInput({
          formatPhaseFinale: FormatPhaseFinale.POULES_FINALES,
          jours: [
            makeJour({ numeroJour: 1 }),
            makeJour({ numeroJour: 2 }),
            makeJour({ numeroJour: 3 }),
          ],
        }),
      );
      expect(matches.every((m) => m.refVainqueurProduit === null)).toBe(true);
    });
  });

  describe('phase finale — CLASSEMENT_CROISE', () => {
    it('oppose directement les qualifiés de poules adjacentes par rang croisé', () => {
      const { matches } = service.genere(
        baseInput({
          formatPhaseFinale: FormatPhaseFinale.CLASSEMENT_CROISE,
          jours: [
            makeJour({ numeroJour: 1 }),
            makeJour({ numeroJour: 2 }),
            makeJour({ numeroJour: 3 }),
          ],
        }),
      );
      const qualif = matches.filter((m) => m.phase === 'QUALIFICATION');
      expect(qualif).toHaveLength(2);
      expect(qualif.map((m) => [m.equipe1Nom, m.equipe2Nom])).toEqual([
        ['1er Poule A', '2e Poule B'],
        ['2e Poule A', '1er Poule B'],
      ]);
    });

    it("ne renseigne jamais refVainqueurProduit (pas de confrontation chaînée dans ce format)", () => {
      const { matches } = service.genere(
        baseInput({
          formatPhaseFinale: FormatPhaseFinale.CLASSEMENT_CROISE,
          jours: [
            makeJour({ numeroJour: 1 }),
            makeJour({ numeroJour: 2 }),
            makeJour({ numeroJour: 3 }),
          ],
        }),
      );
      expect(matches.every((m) => m.refVainqueurProduit === null)).toBe(true);
    });
  });

  describe('occupation des patinoires', () => {
    it("répartit les matchs dans une seule vague quand assez de patinoires sont disponibles", () => {
      const { matches } = service.genere(baseInput({ nbPatinoires: 2 }));
      const brassage = matches.filter((m) => m.phase === 'BRASSAGE');
      expect(brassage[0].dateHeure.getTime()).toBe(brassage[1].dateHeure.getTime());
    });

    it("étale les matchs sur plusieurs vagues quand une seule patinoire est disponible", () => {
      const { matches } = service.genere(baseInput({ nbPatinoires: 1 }));
      const brassage = matches.filter((m) => m.phase === 'BRASSAGE');
      expect(brassage[0].dateHeure.getTime()).toBeLessThan(brassage[1].dateHeure.getTime());
    });

    it("ne place jamais deux matchs de la même vague pour une équipe déjà occupée", () => {
      const { matches } = service.genere(
        baseInput({ equipes: makeEquipesReelles(4), nbPoules: 1, nbPatinoires: 4 }),
      );
      const parVague = new Map<number, Set<string>>();
      for (const m of matches) {
        const t = m.dateHeure.getTime();
        if (!parVague.has(t)) parVague.set(t, new Set());
        const set = parVague.get(t)!;
        expect(set.has(m.equipe1Ref)).toBe(false);
        expect(set.has(m.equipe2Ref)).toBe(false);
        set.add(m.equipe1Ref);
        set.add(m.equipe2Ref);
      }
    });
  });

  describe('qualifies (sortie de genere())', () => {
    it('expose les mêmes refs/libellés que ceux utilisés dans les matchs de phase finale', () => {
      const { matches, qualifies } = service.genere(
        baseInput({
          jours: [makeJour({ numeroJour: 1 }), makeJour({ numeroJour: 2 }), makeJour({ numeroJour: 3 })],
        }),
      );
      const finale = matches.filter((m) => m.phase !== 'BRASSAGE');
      for (const q of qualifies) {
        const apparait = finale.some(
          (m) => m.equipe1Ref === q.ref || m.equipe2Ref === q.ref,
        );
        expect(apparait).toBe(true);
      }
    });

    it('reste vide si aucune poule ne peut fournir de qualifié (0 équipe)', () => {
      const { qualifies } = service.genere(baseInput({ equipes: [], nbPoules: 2 }));
      expect(qualifies).toEqual([]);
    });
  });

  describe('participantsAttendusParJour', () => {
    it('dérive les participants du jour à partir des refs distinctes présentes dans les matchs de ce jour', () => {
      const jour2 = makeJour({ numeroJour: 2 });
      const jour3 = makeJour({ numeroJour: 3 });
      const matches = [
        makeMatchGenere({
          jour: 2,
          equipe1Ref: 'placeholder:poule-A-rang-1',
          equipe1Nom: '1er Poule A',
          equipe2Ref: 'placeholder:poule-B-rang-1',
          equipe2Nom: '1er Poule B',
          phase: 'QUALIFICATION',
        }),
      ];
      const qualifies = [
        { ref: 'placeholder:poule-A-rang-1', nom: '1er Poule A', poule: 'A', rang: 1 },
        { ref: 'placeholder:poule-B-rang-1', nom: '1er Poule B', poule: 'B', rang: 1 },
      ];

      const parJour = service.participantsAttendusParJour(matches, qualifies, [jour2, jour3]);

      expect(parJour.get(2)).toEqual([
        { ref: 'placeholder:poule-A-rang-1', nom: '1er Poule A' },
        { ref: 'placeholder:poule-B-rang-1', nom: '1er Poule B' },
      ]);
      expect(parJour.get(3)).toEqual([]);
    });

    it('inclut un participant sur chacun des jours où il a un match (présence multi-jours)', () => {
      const jour2 = makeJour({ numeroJour: 2 });
      const jour3 = makeJour({ numeroJour: 3 });
      const matches = [
        makeMatchGenere({ jour: 2, equipe1Ref: 'a', equipe1Nom: 'A', equipe2Ref: 'b', equipe2Nom: 'B', phase: 'QUALIFICATION' }),
        makeMatchGenere({ jour: 3, equipe1Ref: 'a', equipe1Nom: 'A', equipe2Ref: 'c', equipe2Nom: 'C', phase: 'QUALIFICATION' }),
      ];
      const qualifies = [
        { ref: 'a', nom: 'A', poule: 'A', rang: 1 },
        { ref: 'b', nom: 'B', poule: 'B', rang: 1 },
        { ref: 'c', nom: 'C', poule: 'C', rang: 1 },
      ];

      const parJour = service.participantsAttendusParJour(matches, qualifies, [jour2, jour3]);

      expect(parJour.get(2)!.map((p) => p.ref).sort()).toEqual(['a', 'b']);
      expect(parJour.get(3)!.map((p) => p.ref).sort()).toEqual(['a', 'c']);
    });

    it("rattache au DERNIER jour de finale tout qualifié n'apparaissant dans aucun match (filet de sécurité)", () => {
      const jour2 = makeJour({ numeroJour: 2 });
      const jour3 = makeJour({ numeroJour: 3 });
      const matches = [
        makeMatchGenere({ jour: 2, equipe1Ref: 'a', equipe1Nom: 'A', equipe2Ref: 'b', equipe2Nom: 'B', phase: 'QUALIFICATION' }),
      ];
      const qualifies = [
        { ref: 'a', nom: 'A', poule: 'A', rang: 1 },
        { ref: 'b', nom: 'B', poule: 'B', rang: 1 },
        { ref: 'c', nom: 'C', poule: 'C', rang: 1 }, // orphelin : aucun match sur aucun jour
      ];

      const parJour = service.participantsAttendusParJour(matches, qualifies, [jour2, jour3]);

      expect(parJour.get(2)!.map((p) => p.ref)).toEqual(['a', 'b']);
      expect(parJour.get(3)).toEqual([{ ref: 'c', nom: 'C' }]);
    });

    it('retourne une map vide sans jour de finale', () => {
      const parJour = service.participantsAttendusParJour([], [], []);
      expect(parJour.size).toBe(0);
    });

    it('CLASSEMENT_CROISE à nombre de poules impair (3) : la poule sans adversaire est rattachée au dernier jour de finale', () => {
      const jours = [
        makeJour({ numeroJour: 1 }),
        makeJour({ numeroJour: 2 }),
        makeJour({ numeroJour: 3 }),
      ];
      const { matches, qualifies } = service.genere(
        baseInput({
          equipes: makeEquipesReelles(6),
          nbPoules: 3,
          nbEquipesQualifieesParPoule: 1,
          formatPhaseFinale: FormatPhaseFinale.CLASSEMENT_CROISE,
          jours,
        }),
      );
      expect(qualifies.map((q) => q.ref).sort()).toEqual(
        [
          'placeholder:poule-A-rang-1',
          'placeholder:poule-B-rang-1',
          'placeholder:poule-C-rang-1',
        ].sort(),
      );

      const parJour = service.participantsAttendusParJour(matches, qualifies, jours.slice(1));

      expect(parJour.get(2)!.map((p) => p.ref).sort()).toEqual(
        ['placeholder:poule-A-rang-1', 'placeholder:poule-B-rang-1'].sort(),
      );
      expect(parJour.get(3)!.map((p) => p.ref)).toEqual(['placeholder:poule-C-rang-1']);
    });

    it('POULES_FINALES à une seule poule : les qualifiés sans adversaire de même rang sont rattachés au dernier jour de finale', () => {
      const jours = [makeJour({ numeroJour: 1 }), makeJour({ numeroJour: 2 })];
      const { matches, qualifies } = service.genere(
        baseInput({
          equipes: makeEquipesReelles(4),
          nbPoules: 1,
          nbEquipesQualifieesParPoule: 2,
          formatPhaseFinale: FormatPhaseFinale.POULES_FINALES,
          jours,
        }),
      );
      expect(qualifies.map((q) => q.ref).sort()).toEqual(
        ['placeholder:poule-A-rang-1', 'placeholder:poule-A-rang-2'].sort(),
      );
      // Aucun match de finale : chaque groupe de rang n'a qu'1 seul membre
      // (une seule poule), un round-robin à 1 élément ne produit aucune paire.
      expect(matches.filter((m) => m.phase !== 'BRASSAGE')).toEqual([]);

      const parJour = service.participantsAttendusParJour(matches, qualifies, jours.slice(1));

      expect(parJour.get(2)!.map((p) => p.ref).sort()).toEqual(
        ['placeholder:poule-A-rang-1', 'placeholder:poule-A-rang-2'].sort(),
      );
    });
  });
});
