import { Injectable } from '@nestjs/common';
import { MatchGenere } from '../../domain/entities/match-genere.entity';
import { ActiviteGeneree } from '../../domain/entities/simulation-result.entity';
import { InscEditionJour } from '../../domain/entities/inscription-edition-jour.entity';
import { EquipeSimulation } from '../../domain/entities/equipe-simulation.entity';
import { MatriceDelaiMinActivite } from '../../domain/entities/parametres-sportifs.entity';

type ActiviteNormalisee = {
  ref: string;
  type: string; // 'match' ou String(activiteId) du catalogue
  debut: Date;
  fin: Date;
};

export type VerificationInput = {
  matches: MatchGenere[];
  activites: ActiviteGeneree[];
  jours: InscEditionJour[];
  delaiMinActivite: MatriceDelaiMinActivite | null;
  nbPatinoires: number;
  equipes: EquipeSimulation[];
};

@Injectable()
export class VerificationPlanningService {
  verifier(input: VerificationInput): string[] {
    const violations = new Set<string>();

    const parEquipe = this.regrouperParEquipe(input.matches, input.activites);
    const jourParNumero = new Map(input.jours.map((j) => [j.numeroJour, j]));
    const matrice = input.delaiMinActivite ?? {};

    for (const [ref, activitesEquipe] of parEquipe) {
      const triees = [...activitesEquipe].sort(
        (a, b) => a.debut.getTime() - b.debut.getTime(),
      );

      for (let i = 0; i < triees.length; i++) {
        const act = triees[i];
        // Bornes de journée : uniquement pour les matchs — un créneau
        // d'activité n'a pas de lien vers les Jours de compétition en v1
        // (spec §2.3, aucune validation croisée).
        if (act.type === 'match') {
          const jourMatch = this.jourDeMatch(act, input.matches);
          const jour = jourMatch != null ? jourParNumero.get(jourMatch) : null;
          if (jour) {
            if (act.debut < jour.heureDebut) {
              violations.add(
                `${ref} : activité avant le début de la journée (${jour.heureDebut.toISOString()})`,
              );
            }
            if (act.fin > jour.heureFin) {
              violations.add(
                `${ref} : activité après la fin de la journée (${jour.heureFin.toISOString()})`,
              );
            }
          }
        }

        if (i === 0) continue;
        const prec = triees[i - 1];

        if (act.debut < prec.fin) {
          const overlap = Math.round(
            (prec.fin.getTime() - act.debut.getTime()) / 60_000,
          );
          violations.add(
            `${ref} : chevauchement ${prec.type}/${act.type} (${overlap} min)`,
          );
          continue;
        }

        const gapMin = Math.round(
          (act.debut.getTime() - prec.fin.getTime()) / 60_000,
        );
        const minGap = matrice[prec.type]?.[act.type] ?? 0;
        if (gapMin < minGap) {
          violations.add(
            `${ref} : délai ${prec.type}→${act.type} = ${gapMin} min (min ${minGap} min, déficit ${minGap - gapMin} min)`,
          );
        }
      }
    }

    // Occupation patinoires : par jour, compte les matchs simultanés (même créneau exact).
    const parJourEtCreneau = new Map<string, number>();
    for (const m of input.matches) {
      const cle = `${m.jour}|${m.dateHeure.getTime()}`;
      parJourEtCreneau.set(cle, (parJourEtCreneau.get(cle) ?? 0) + 1);
    }
    for (const [cle, count] of parJourEtCreneau) {
      if (count > Math.max(1, input.nbPatinoires || 1)) {
        const [jour] = cle.split('|');
        violations.add(
          `Jour ${jour} : ${count} matchs simultanés pour ${input.nbPatinoires || 1} patinoire(s) disponible(s)`,
        );
      }
    }

    // Équipes fictives (bloquant par défaut pour la confirmation, cf. §7).
    const nbFictives = input.equipes.filter((e) => e.fictive).length;
    if (nbFictives > 0) {
      violations.add(
        `${nbFictives} équipe(s) fictive(s) présente(s) dans le planning — confirmation bloquée sauf contournement explicite`,
      );
    }

    return [...violations];
  }

  private regrouperParEquipe(
    matches: MatchGenere[],
    activites: ActiviteGeneree[],
  ): Map<string, ActiviteNormalisee[]> {
    const map = new Map<string, ActiviteNormalisee[]>();
    const push = (ref: string, act: ActiviteNormalisee) => {
      if (!map.has(ref)) map.set(ref, []);
      map.get(ref)!.push(act);
    };

    for (const m of matches) {
      const fin = new Date(m.dateHeure.getTime() + m.dureeMin * 60_000);
      push(m.equipe1Ref, {
        ref: m.equipe1Ref,
        type: 'match',
        debut: m.dateHeure,
        fin,
      });
      push(m.equipe2Ref, {
        ref: m.equipe2Ref,
        type: 'match',
        debut: m.dateHeure,
        fin,
      });
    }
    for (const a of activites) {
      push(a.equipeRef, {
        ref: a.equipeRef,
        type: String(a.activiteId),
        debut: a.debut,
        fin: a.fin,
      });
    }
    return map;
  }

  private jourDeMatch(
    act: ActiviteNormalisee,
    matches: MatchGenere[],
  ): number | null {
    const m = matches.find(
      (m) => m.dateHeure.getTime() === act.debut.getTime(),
    );
    return m?.jour ?? null;
  }
}
