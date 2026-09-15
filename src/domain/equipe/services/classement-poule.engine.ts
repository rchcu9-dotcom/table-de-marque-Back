import { Injectable } from '@nestjs/common';

export type ResultatMatchPoule = {
  equipeIdA: number;
  equipeIdB: number;
  scoreA: number;
  scoreB: number;
};

export type StatsEquipePoule = {
  equipeId: number;
  joues: number;
  victoires: number;
  nuls: number;
  defaites: number;
  points: number;
  bp: number;
  bc: number;
  diff: number;
  rang: number;
};

type StatsAccumulator = Omit<StatsEquipePoule, 'rang'>;

/**
 * Reglés par défaut si `ParametresSportifs.reglesTieBreak` est absent —
 * dupliqué depuis `planning/domain/entities/parametres-sportifs.entity.ts`
 * (decisions.json#1788558906931) plutôt qu'importé, pour ne pas créer de
 * dépendance domaine `equipe` -> domaine `planning` (ReglesTieBreak n'étant
 * qu'un alias structurel de `string[]`, aucun import n'est nécessaire ici).
 */
const DEFAULT_CRITERES: string[] = [
  'points',
  'difference_buts',
  'buts_marques',
  'confrontation_directe',
];

const POINTS_VICTOIRE = 2;
const POINTS_NUL = 1;

@Injectable()
export class ClassementPouleEngine {
  compute(
    equipeIds: number[],
    resultats: ResultatMatchPoule[],
    reglesTieBreak: string[] | null,
  ): StatsEquipePoule[] {
    const criteres =
      reglesTieBreak && reglesTieBreak.length > 0
        ? reglesTieBreak
        : DEFAULT_CRITERES;

    const statsByEquipe = new Map<number, StatsAccumulator>();
    for (const equipeId of equipeIds) {
      statsByEquipe.set(equipeId, this.statsVierges(equipeId));
    }

    for (const resultat of resultats) {
      this.appliquerResultat(statsByEquipe, resultat);
    }

    const entries = Array.from(statsByEquipe.values());
    entries.sort((a, b) =>
      this.comparerEquipes(a, b, entries, resultats, criteres),
    );

    return this.attribuerRangs(entries, resultats, criteres);
  }

  private statsVierges(equipeId: number): StatsAccumulator {
    return {
      equipeId,
      joues: 0,
      victoires: 0,
      nuls: 0,
      defaites: 0,
      points: 0,
      bp: 0,
      bc: 0,
      diff: 0,
    };
  }

  private appliquerResultat(
    statsByEquipe: Map<number, StatsAccumulator>,
    resultat: ResultatMatchPoule,
  ): void {
    const statsA = statsByEquipe.get(resultat.equipeIdA);
    const statsB = statsByEquipe.get(resultat.equipeIdB);
    if (!statsA || !statsB) return;

    statsA.joues += 1;
    statsB.joues += 1;
    statsA.bp += resultat.scoreA;
    statsA.bc += resultat.scoreB;
    statsB.bp += resultat.scoreB;
    statsB.bc += resultat.scoreA;
    statsA.diff = statsA.bp - statsA.bc;
    statsB.diff = statsB.bp - statsB.bc;

    if (resultat.scoreA > resultat.scoreB) {
      statsA.victoires += 1;
      statsA.points += POINTS_VICTOIRE;
      statsB.defaites += 1;
    } else if (resultat.scoreA < resultat.scoreB) {
      statsB.victoires += 1;
      statsB.points += POINTS_VICTOIRE;
      statsA.defaites += 1;
    } else {
      statsA.nuls += 1;
      statsB.nuls += 1;
      statsA.points += POINTS_NUL;
      statsB.points += POINTS_NUL;
    }
  }

  private comparerEquipes(
    a: StatsAccumulator,
    b: StatsAccumulator,
    entries: StatsAccumulator[],
    resultats: ResultatMatchPoule[],
    criteres: string[],
  ): number {
    for (let i = 0; i < criteres.length; i++) {
      const cmp = this.comparerParCritere(
        a,
        b,
        entries,
        resultats,
        criteres[i],
        criteres.slice(0, i),
      );
      if (cmp !== 0) return cmp;
    }
    return 0;
  }

  private comparerParCritere(
    a: StatsAccumulator,
    b: StatsAccumulator,
    entries: StatsAccumulator[],
    resultats: ResultatMatchPoule[],
    critere: string,
    criteresPrecedents: string[],
  ): number {
    switch (critere) {
      case 'points':
        return b.points - a.points;
      case 'difference_buts':
        return b.diff - a.diff;
      case 'buts_marques':
        return b.bp - a.bp;
      case 'confrontation_directe':
        return this.comparerConfrontationDirecte(
          a,
          b,
          entries,
          resultats,
          criteresPrecedents,
        );
      default:
        // Critère non reconnu : ne départage pas, passe au suivant.
        return 0;
    }
  }

  /**
   * Comparaison par paire uniquement (decisions.json#1789208955016) : avant
   * d'utiliser la confrontation directe, vérifie qu'exactement 2 équipes
   * (a et b) sont encore à égalité sur les critères précédents parmi
   * *toute* la poule — si une 3e équipe (ou plus) partage la même égalité
   * (ex. égalité circulaire A bat B bat C bat A), le critère ne départage
   * pas, conformément à la décision de ne jamais construire de mini-
   * classement multi-équipes ni produire un ordre non transitif.
   */
  private comparerConfrontationDirecte(
    a: StatsAccumulator,
    b: StatsAccumulator,
    entries: StatsAccumulator[],
    resultats: ResultatMatchPoule[],
    criteresPrecedents: string[],
  ): number {
    const groupeExAequo = entries.filter(
      (e) =>
        e === a ||
        e === b ||
        this.comparerEquipes(a, e, entries, resultats, criteresPrecedents) ===
          0,
    );
    if (groupeExAequo.length > 2) return 0;

    const directs = resultats.filter(
      (r) =>
        (r.equipeIdA === a.equipeId && r.equipeIdB === b.equipeId) ||
        (r.equipeIdA === b.equipeId && r.equipeIdB === a.equipeId),
    );
    if (directs.length === 0) return 0;

    let butsA = 0;
    let butsB = 0;
    for (const r of directs) {
      const aEstCoteA = r.equipeIdA === a.equipeId;
      butsA += aEstCoteA ? r.scoreA : r.scoreB;
      butsB += aEstCoteA ? r.scoreB : r.scoreA;
    }
    return butsB - butsA;
  }

  private attribuerRangs(
    equipesTriees: StatsAccumulator[],
    resultats: ResultatMatchPoule[],
    criteres: string[],
  ): StatsEquipePoule[] {
    const result: StatsEquipePoule[] = [];
    equipesTriees.forEach((entry, index) => {
      if (index === 0) {
        result.push({ ...entry, rang: 1 });
        return;
      }
      const exAequo =
        this.comparerEquipes(
          equipesTriees[index - 1],
          entry,
          equipesTriees,
          resultats,
          criteres,
        ) === 0;
      const rang = exAequo ? result[index - 1].rang : index + 1;
      result.push({ ...entry, rang });
    });
    return result;
  }
}
