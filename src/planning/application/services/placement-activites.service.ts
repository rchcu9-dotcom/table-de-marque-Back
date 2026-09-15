import { Injectable } from '@nestjs/common';
import { MatchGenere } from '../../domain/entities/match-genere.entity';
import { ActiviteCatalogue } from '../../domain/entities/activite-catalogue.entity';
import { CreneauActivite } from '../../domain/entities/creneau-activite.entity';
import {
  ActiviteGeneree,
  ScoreSimulation,
} from '../../domain/entities/simulation-result.entity';
import { MatriceDelaiMinActivite } from '../../domain/entities/parametres-sportifs.entity';

type Slot = { type: string; debut: number; fin: number };

const PEN_GAP_PER_MIN = 10;

export type PlacementJourInput = {
  candidats: { ref: string; nom: string }[]; // équipes (J1) ou qualifiés attendus (J2/J3)
  matchesDuJour: MatchGenere[];
  creneauxDuJour: CreneauActivite[]; // créneaux LIBRE de ce jour, toutes activités confondues
  activites: ActiviteCatalogue[]; // catalogue de l'édition (résolution du label affiché)
  delaiMinActivite: MatriceDelaiMinActivite | null;
};

export type PlacementJourOutput = {
  assignations: ActiviteGeneree[];
  score: ScoreSimulation;
};

/**
 * Affecte les équipes/qualifiés candidats aux créneaux d'activité déjà
 * existants (saisis manuellement par l'admin, cf. spec §2.3/§2.5) — le moteur
 * ne génère plus aucun horaire, il ne fait plus que choisir, pour chaque
 * créneau, le candidat qui minimise la pénalité de chevauchement/délai vis-
 * à-vis de ses activités déjà connues ce jour-là (matchs + activités déjà
 * assignées). Les groupes d'activité du jour sont traités dans l'ordre
 * chronologique de leur premier créneau, pour que l'affectation d'une
 * activité tienne compte des activités déjà casées plus tôt dans la journée.
 *
 * Contrairement à l'ancien moteur (recuit simulé sur l'ordre CHALLENGE/REPAS
 * générés dynamiquement), il n'y a plus d'ordre à optimiser : les créneaux
 * ont un horaire fixe saisi par l'admin. Un seul passage glouton par activité
 * suffit ; le score retourné n'est plus qu'indicatif (pas de recherche
 * d'optimum).
 */
@Injectable()
export class PlacementActivitesService {
  placerActivitesJour(input: PlacementJourInput): PlacementJourOutput {
    const {
      candidats,
      matchesDuJour,
      creneauxDuJour,
      activites,
      delaiMinActivite,
    } = input;

    if (candidats.length === 0 || creneauxDuJour.length === 0) {
      return { assignations: [], score: { penalty: 0, slack: 0 } };
    }

    const matrice = delaiMinActivite ?? {};
    const labelParActiviteId = new Map(activites.map((a) => [a.id, a.label]));
    const matchesParEquipe = this.regrouperMatchsParEquipe(matchesDuJour);

    const activitesExistantesParRef = new Map<string, Slot[]>();
    for (const [ref, slots] of matchesParEquipe) {
      activitesExistantesParRef.set(ref, [...slots]);
    }

    const groupes = [
      ...this.regrouperParActivite(creneauxDuJour).entries(),
    ].sort(
      (a, b) => a[1][0].heureDebut.getTime() - b[1][0].heureDebut.getTime(),
    );

    const assignations: ActiviteGeneree[] = [];
    for (const [activiteId, creneaux] of groupes) {
      const affectations = this.assignerCreneauxActivite(
        creneaux,
        candidats,
        activitesExistantesParRef,
        matrice,
      );
      for (const { creneau, ref, nom } of affectations) {
        const debut = creneau.heureDebut;
        const fin = new Date(debut.getTime() + creneau.dureeMin * 60_000);
        assignations.push({
          creneauId: creneau.id,
          activiteId,
          activiteLabel:
            labelParActiviteId.get(activiteId) ?? `Activité ${activiteId}`,
          equipeRef: ref,
          equipeNom: nom,
          debut,
          fin,
        });
        const slots = activitesExistantesParRef.get(ref) ?? [];
        slots.push({
          type: String(activiteId),
          debut: debut.getTime(),
          fin: fin.getTime(),
        });
        activitesExistantesParRef.set(ref, slots);
      }
    }

    const score = this.evaluerAssignations(
      candidats.map((c) => c.ref),
      matchesParEquipe,
      assignations,
      matrice,
    );

    return { assignations, score };
  }

  private regrouperMatchsParEquipe(
    matches: MatchGenere[],
  ): Map<string, Slot[]> {
    const map = new Map<string, Slot[]>();
    for (const m of matches) {
      const debut = m.dateHeure.getTime();
      const fin = debut + m.dureeMin * 60_000;
      for (const ref of [m.equipe1Ref, m.equipe2Ref]) {
        if (!map.has(ref)) map.set(ref, []);
        map.get(ref)!.push({ type: 'match', debut, fin });
      }
    }
    return map;
  }

  private regrouperParActivite(
    creneaux: CreneauActivite[],
  ): Map<number, CreneauActivite[]> {
    const map = new Map<number, CreneauActivite[]>();
    for (const c of creneaux) {
      if (!map.has(c.activiteId)) map.set(c.activiteId, []);
      map.get(c.activiteId)!.push(c);
    }
    for (const liste of map.values()) {
      liste.sort((a, b) => a.heureDebut.getTime() - b.heureDebut.getTime());
    }
    return map;
  }

  /**
   * Affectation gloutonne créneau ↔ candidat sous contrainte de délai minimal
   * (matrice `type précédent → activité` / `activité → type suivant`, clés
   * `'match'` ou `String(activiteId)`) : pour chaque créneau (dans l'ordre
   * chronologique), choisit le candidat restant qui minimise la pénalité de
   * chevauchement/délai vis-à-vis de ses activités déjà connues ce jour-là.
   * Si un candidat ne trouve pas de créneau (plus de candidats que de
   * créneaux saisis par l'admin pour cette activité), il n'est simplement
   * pas assigné — aucun garde-fou de génération automatique ici (cf. spec
   * §4, risque assumé).
   */
  private assignerCreneauxActivite(
    creneaux: CreneauActivite[],
    candidats: { ref: string; nom: string }[],
    activitesExistantesParRef: Map<string, Slot[]>,
    matrice: MatriceDelaiMinActivite,
  ): { creneau: CreneauActivite; ref: string; nom: string }[] {
    const restants = new Map(candidats.map((c) => [c.ref, c.nom]));
    const resultat: { creneau: CreneauActivite; ref: string; nom: string }[] =
      [];

    for (const creneau of creneaux) {
      const debutSlot = creneau.heureDebut.getTime();
      const finSlot = debutSlot + creneau.dureeMin * 60_000;
      const activiteKey = String(creneau.activiteId);
      let meilleurRef: string | null = null;
      let meilleurePenalite = Infinity;

      for (const ref of restants.keys()) {
        const existantes = activitesExistantesParRef.get(ref) ?? [];
        let penalite = 0;
        for (const act of existantes) {
          if (debutSlot < act.fin && finSlot > act.debut) {
            penalite += 999;
            continue;
          }
          if (finSlot <= act.debut) {
            const gap = (act.debut - finSlot) / 60_000;
            const requis = matrice[activiteKey]?.[act.type] ?? 0;
            if (gap < requis) penalite += requis - gap;
          }
          if (act.fin <= debutSlot) {
            const gap = (debutSlot - act.fin) / 60_000;
            const requis = matrice[act.type]?.[activiteKey] ?? 0;
            if (gap < requis) penalite += requis - gap;
          }
        }
        if (penalite < meilleurePenalite) {
          meilleurePenalite = penalite;
          meilleurRef = ref;
        }
      }

      if (meilleurRef) {
        resultat.push({
          creneau,
          ref: meilleurRef,
          nom: restants.get(meilleurRef)!,
        });
        restants.delete(meilleurRef);
      }
    }

    return resultat;
  }

  private evaluerAssignations(
    refsCandidats: string[],
    matchesParEquipe: Map<string, Slot[]>,
    assignations: ActiviteGeneree[],
    matrice: MatriceDelaiMinActivite,
  ): ScoreSimulation {
    let penalty = 0;
    let slack = 0;

    const assignationsParEquipe = new Map<string, Slot[]>();
    for (const a of assignations) {
      if (!assignationsParEquipe.has(a.equipeRef)) {
        assignationsParEquipe.set(a.equipeRef, []);
      }
      assignationsParEquipe.get(a.equipeRef)!.push({
        type: String(a.activiteId),
        debut: a.debut.getTime(),
        fin: a.fin.getTime(),
      });
    }

    for (const ref of refsCandidats) {
      const activitesTriees = [
        ...(matchesParEquipe.get(ref) ?? []),
        ...(assignationsParEquipe.get(ref) ?? []),
      ].sort((a, b) => a.debut - b.debut);

      for (let i = 0; i < activitesTriees.length - 1; i++) {
        const de = activitesTriees[i];
        const vers = activitesTriees[i + 1];
        if (vers.debut < de.fin) {
          penalty += ((de.fin - vers.debut) / 60_000) * PEN_GAP_PER_MIN * 3;
          continue;
        }
        const gap = (vers.debut - de.fin) / 60_000;
        const minGap = matrice[de.type]?.[vers.type] ?? 0;
        if (gap < minGap) {
          penalty += (minGap - gap) * PEN_GAP_PER_MIN;
        } else {
          slack += Math.min(gap - minGap, 90);
        }
      }
    }

    return { penalty, slack };
  }
}
