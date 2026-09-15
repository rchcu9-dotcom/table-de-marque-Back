import {
  ClassementPouleEngine,
  ResultatMatchPoule,
} from './classement-poule.engine';

const DEFAULT_CRITERES = [
  'points',
  'difference_buts',
  'buts_marques',
  'confrontation_directe',
];

describe('ClassementPouleEngine', () => {
  let engine: ClassementPouleEngine;

  beforeEach(() => {
    engine = new ClassementPouleEngine();
  });

  it('classe par points décroissants quand aucune égalité', () => {
    // A bat B (2-0), A bat C (1-0), B bat C (3-1) : A=4pts, B=2pts, C=0pt.
    const resultats: ResultatMatchPoule[] = [
      { equipeIdA: 1, equipeIdB: 2, scoreA: 2, scoreB: 0 },
      { equipeIdA: 1, equipeIdB: 3, scoreA: 1, scoreB: 0 },
      { equipeIdA: 2, equipeIdB: 3, scoreA: 3, scoreB: 1 },
    ];

    const result = engine.compute([1, 2, 3], resultats, DEFAULT_CRITERES);

    expect(result.map((r) => r.equipeId)).toEqual([1, 2, 3]);
    expect(result.map((r) => r.rang)).toEqual([1, 2, 3]);
    const equipe1 = result.find((r) => r.equipeId === 1)!;
    expect(equipe1).toMatchObject({
      joues: 2,
      victoires: 2,
      nuls: 0,
      defaites: 0,
      points: 4,
      bp: 3,
      bc: 0,
      diff: 3,
    });
  });

  it('attribue 2 points pour une victoire, 1 pour un nul, 0 pour une défaite', () => {
    const resultats: ResultatMatchPoule[] = [
      { equipeIdA: 1, equipeIdB: 2, scoreA: 2, scoreB: 2 }, // nul
    ];

    const result = engine.compute([1, 2], resultats, DEFAULT_CRITERES);

    expect(result.find((r) => r.equipeId === 1)).toMatchObject({
      victoires: 0,
      nuls: 1,
      defaites: 0,
      points: 1,
    });
    expect(result.find((r) => r.equipeId === 2)).toMatchObject({
      victoires: 0,
      nuls: 1,
      defaites: 0,
      points: 1,
    });
  });

  it('départage par différence de buts quand les points sont égaux', () => {
    // A : 1 victoire large (5-0) = 2pts, diff +5. B : 1 victoire courte (1-0) = 2pts, diff +1.
    const resultats: ResultatMatchPoule[] = [
      { equipeIdA: 1, equipeIdB: 3, scoreA: 5, scoreB: 0 },
      { equipeIdA: 2, equipeIdB: 4, scoreA: 1, scoreB: 0 },
    ];

    const result = engine.compute([1, 2, 3, 4], resultats, DEFAULT_CRITERES);

    const rangA = result.find((r) => r.equipeId === 1)!.rang;
    const rangB = result.find((r) => r.equipeId === 2)!.rang;
    expect(rangA).toBeLessThan(rangB);
  });

  it('départage par buts marqués quand points et différence de buts sont égaux', () => {
    // A : victoire 4-2 (diff +2, 4 BM). B : victoire 3-1 (diff +2, 3 BM). Points égaux, diff égale.
    const resultats: ResultatMatchPoule[] = [
      { equipeIdA: 1, equipeIdB: 3, scoreA: 4, scoreB: 2 },
      { equipeIdA: 2, equipeIdB: 4, scoreA: 3, scoreB: 1 },
    ];

    const result = engine.compute([1, 2, 3, 4], resultats, DEFAULT_CRITERES);

    const rangA = result.find((r) => r.equipeId === 1)!.rang;
    const rangB = result.find((r) => r.equipeId === 2)!.rang;
    expect(rangA).toBeLessThan(rangB);
  });

  it('départage par confrontation directe en dernier recours (comparaison par paire)', () => {
    // A et B ont exactement les mêmes points/diff/BP via des adversaires tiers,
    // mais A a battu B en confrontation directe.
    const resultats: ResultatMatchPoule[] = [
      { equipeIdA: 1, equipeIdB: 2, scoreA: 3, scoreB: 1 }, // confrontation directe : A bat B
      { equipeIdA: 1, equipeIdB: 3, scoreA: 2, scoreB: 2 },
      { equipeIdA: 2, equipeIdB: 3, scoreA: 2, scoreB: 2 },
    ];

    const result = engine.compute([1, 2, 3], resultats, DEFAULT_CRITERES);

    // Sans confrontation_directe, A (2G+1N -> pts 2*2+1=5, bp 5, bc 3, diff 2)
    // et B (0G+1N+1D -> pts 1, bp 3, bc 5, diff -2) ne sont de toute façon pas
    // à égalité ici : ce test vérifie surtout que le critère ne casse rien et
    // que A reste bien devant B (confirmé indépendamment par les points).
    const rangA = result.find((r) => r.equipeId === 1)!.rang;
    const rangB = result.find((r) => r.equipeId === 2)!.rang;
    expect(rangA).toBeLessThan(rangB);
  });

  it('confrontation_directe départage deux équipes strictement à égalité sur points/diff/BP', () => {
    // Poule de 3 équipes en round-robin, construite pour que A (1) et B (2)
    // terminent rigoureusement à égalité (points=2, diff=0, bp=2 chacun) via
    // des résultats différents face à C (3), seule leur confrontation directe
    // (A bat B 2-1) les départage. C partage les mêmes points/diff mais un bp
    // inférieur (1), donc termine 3e sans interférer avec la comparaison A/B.
    const resultats: ResultatMatchPoule[] = [
      { equipeIdA: 1, equipeIdB: 2, scoreA: 2, scoreB: 1 }, // confrontation directe : A bat B
      { equipeIdA: 1, equipeIdB: 3, scoreA: 0, scoreB: 1 }, // A perd 0-1 contre C
      { equipeIdA: 2, equipeIdB: 3, scoreA: 1, scoreB: 0 }, // B bat C 1-0
    ];

    const result = engine.compute([1, 2, 3], resultats, DEFAULT_CRITERES);
    const equipeA = result.find((r) => r.equipeId === 1)!;
    const equipeB = result.find((r) => r.equipeId === 2)!;
    const equipeC = result.find((r) => r.equipeId === 3)!;

    expect(equipeA.points).toBe(equipeB.points);
    expect(equipeA.diff).toBe(equipeB.diff);
    expect(equipeA.bp).toBe(equipeB.bp);
    expect(equipeA.rang).toBe(1);
    expect(equipeB.rang).toBe(2);
    expect(equipeC.rang).toBe(3);
  });

  it('ne départage pas confrontation_directe pour un groupe de 3 équipes ou plus (comparaison par paire uniquement)', () => {
    // A, B, C : égalité circulaire à 3 (chacun bat un et perd contre un autre),
    // confrontation_directe ne peut pas trancher un groupe de 3 -> égalité actée.
    const resultats: ResultatMatchPoule[] = [
      { equipeIdA: 1, equipeIdB: 2, scoreA: 1, scoreB: 0 }, // A bat B
      { equipeIdA: 2, equipeIdB: 3, scoreA: 1, scoreB: 0 }, // B bat C
      { equipeIdA: 3, equipeIdB: 1, scoreA: 1, scoreB: 0 }, // C bat A
    ];

    const result = engine.compute([1, 2, 3], resultats, DEFAULT_CRITERES);

    // Points/diff/bp strictement identiques pour les 3 (1 victoire 1-0, 1 défaite 0-1 chacun).
    expect(result.every((r) => r.points === 2)).toBe(true);
    expect(result.every((r) => r.diff === 0)).toBe(true);
    expect(result.every((r) => r.bp === 1)).toBe(true);
    // Égalité totale non tranchée : les 3 équipes partagent le même rang.
    expect(new Set(result.map((r) => r.rang)).size).toBe(1);
    expect(result.map((r) => r.rang)).toEqual([1, 1, 1]);
  });

  it('ignore un critère de tie-break inconnu et passe au suivant', () => {
    const resultats: ResultatMatchPoule[] = [
      { equipeIdA: 1, equipeIdB: 3, scoreA: 5, scoreB: 0 },
      { equipeIdA: 2, equipeIdB: 4, scoreA: 1, scoreB: 0 },
    ];

    const result = engine.compute(
      [1, 2, 3, 4],
      resultats,
      ['critere_invente', 'points', 'difference_buts'],
    );

    const rangA = result.find((r) => r.equipeId === 1)!.rang;
    const rangB = result.find((r) => r.equipeId === 2)!.rang;
    expect(rangA).toBeLessThan(rangB);
  });

  it('utilise les critères par défaut quand reglesTieBreak est null', () => {
    const resultats: ResultatMatchPoule[] = [
      { equipeIdA: 1, equipeIdB: 3, scoreA: 5, scoreB: 0 },
      { equipeIdA: 2, equipeIdB: 4, scoreA: 1, scoreB: 0 },
    ];

    const result = engine.compute([1, 2, 3, 4], resultats, null);

    const rangA = result.find((r) => r.equipeId === 1)!.rang;
    const rangB = result.find((r) => r.equipeId === 2)!.rang;
    expect(rangA).toBeLessThan(rangB);
  });

  it('utilise les critères par défaut quand reglesTieBreak est un tableau vide', () => {
    const resultats: ResultatMatchPoule[] = [
      { equipeIdA: 1, equipeIdB: 2, scoreA: 2, scoreB: 0 },
    ];

    const result = engine.compute([1, 2], resultats, []);

    expect(result.find((r) => r.equipeId === 1)!.rang).toBe(1);
    expect(result.find((r) => r.equipeId === 2)!.rang).toBe(2);
  });

  it('respecte un ordre de reglesTieBreak personnalisé (buts_marques avant points)', () => {
    // A : 1 victoire 1-0 (1pt... non, 2pts, bp=1). B : 1 victoire 4-2 (2pts, bp=4).
    // Avec ['buts_marques','points'], B doit passer devant A malgré des points égaux.
    const resultats: ResultatMatchPoule[] = [
      { equipeIdA: 1, equipeIdB: 3, scoreA: 1, scoreB: 0 },
      { equipeIdA: 2, equipeIdB: 4, scoreA: 4, scoreB: 2 },
    ];

    const result = engine.compute(
      [1, 2, 3, 4],
      resultats,
      ['buts_marques', 'points'],
    );

    const rangA = result.find((r) => r.equipeId === 1)!.rang;
    const rangB = result.find((r) => r.equipeId === 2)!.rang;
    expect(rangB).toBeLessThan(rangA);
  });

  it('inclut une équipe sans aucun match joué avec des statistiques à zéro', () => {
    const resultats: ResultatMatchPoule[] = [
      { equipeIdA: 1, equipeIdB: 2, scoreA: 3, scoreB: 1 },
    ];

    const result = engine.compute([1, 2, 3], resultats, DEFAULT_CRITERES);

    const equipe3 = result.find((r) => r.equipeId === 3)!;
    expect(equipe3).toMatchObject({
      joues: 0,
      victoires: 0,
      nuls: 0,
      defaites: 0,
      points: 0,
      bp: 0,
      bc: 0,
      diff: 0,
    });
  });

  it('attribue un rang de type "ranking de compétition" (1,2,2,4) sur une égalité au milieu du classement', () => {
    // Poule de 4 en round-robin complet. A (1) gagne tout (rang 1). B (2) et
    // C (3) terminent rigoureusement à égalité (mêmes points/diff/bp, et un
    // nul 1-1 en confrontation directe qui ne les départage pas non plus) :
    // rang 2 partagé. D (4) perd tout (dernier).
    const resultats: ResultatMatchPoule[] = [
      { equipeIdA: 1, equipeIdB: 2, scoreA: 3, scoreB: 0 },
      { equipeIdA: 1, equipeIdB: 3, scoreA: 3, scoreB: 0 },
      { equipeIdA: 1, equipeIdB: 4, scoreA: 3, scoreB: 0 },
      { equipeIdA: 2, equipeIdB: 3, scoreA: 1, scoreB: 1 },
      { equipeIdA: 2, equipeIdB: 4, scoreA: 2, scoreB: 0 },
      { equipeIdA: 3, equipeIdB: 4, scoreA: 2, scoreB: 0 },
    ];

    const result = engine.compute([1, 2, 3, 4], resultats, DEFAULT_CRITERES);
    const byId = new Map(result.map((r) => [r.equipeId, r]));

    expect(byId.get(1)!.rang).toBe(1);
    expect(byId.get(2)!.points).toBe(byId.get(3)!.points);
    expect(byId.get(2)!.diff).toBe(byId.get(3)!.diff);
    expect(byId.get(2)!.bp).toBe(byId.get(3)!.bp);
    expect(byId.get(2)!.rang).toBe(2);
    expect(byId.get(3)!.rang).toBe(2);
    // Le rang suivant (D, dernier) doit sauter le rang consommé par l'égalité :
    // 1, 2, 2, 4 — jamais 1, 2, 2, 3.
    expect(byId.get(4)!.rang).toBe(4);
  });

  it("n'agrège pas de résultat pour une équipe absente de la poule (identifiant inconnu ignoré)", () => {
    const resultats: ResultatMatchPoule[] = [
      { equipeIdA: 1, equipeIdB: 99, scoreA: 2, scoreB: 0 },
    ];

    const result = engine.compute([1], resultats, DEFAULT_CRITERES);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ equipeId: 1, joues: 0, points: 0 });
  });
});
