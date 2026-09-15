import { Injectable } from '@nestjs/common';
import { FormatPhaseFinale } from '../../domain/enums/format-phase-finale.enum';
import { FormatGraphePropose } from '../../domain/repositories/format-graphe.repository';

export type PresetParams = {
  nbPoules: number;
  nbEquipesParPoule: number;
  nbEquipesQualifieesParPoule: number;
};

@Injectable()
export class FormatPresetGeneratorService {
  /**
   * Génère une proposition de graphe (FormatGraphePropose) à partir des
   * paramètres plats hérités du modèle actuel. Produit :
   * - Phase 1 : N groupes de taille nbEquipesParPoule (mécanique CHAMPIONNAT si ≥3, MATCH_UNIQUE si 2)
   * - Phase 2 : groupes de finale déduits du preset choisi
   */
  genererGraphe(
    preset: FormatPhaseFinale,
    params: PresetParams,
  ): FormatGraphePropose {
    const { nbPoules, nbEquipesParPoule, nbEquipesQualifieesParPoule } = params;
    const nbPoulesNorm = Math.max(1, nbPoules);
    const nbEquipesNorm = Math.max(2, nbEquipesParPoule);
    const nbQualifiesNorm = Math.max(
      1,
      Math.min(nbEquipesQualifieesParPoule, nbEquipesNorm),
    );

    const phase1Groupes = Array.from({ length: nbPoulesNorm }, (_, i) => ({
      nom: `Poule ${String.fromCharCode(65 + i)}`,
      ordre: i + 1,
      nbPlaces: nbEquipesNorm,
    }));

    switch (preset) {
      case FormatPhaseFinale.POULES_FINALES:
        return this.genererPoulesFinales(
          phase1Groupes,
          nbPoulesNorm,
          nbQualifiesNorm,
        );
      case FormatPhaseFinale.CLASSEMENT_CROISE:
        return this.genererClassementCroise(
          phase1Groupes,
          nbPoulesNorm,
          nbQualifiesNorm,
        );
      case FormatPhaseFinale.ELIMINATION_DIRECTE:
      default:
        return this.genererEliminationDirecte(
          phase1Groupes,
          nbPoulesNorm,
          nbQualifiesNorm,
        );
    }
  }

  /**
   * POULES_FINALES : tous les Xèmes de chaque poule se regroupent dans un
   * même groupe de phase 2 (round-robin par rang).
   */
  private genererPoulesFinales(
    phase1Groupes: { nom: string; ordre: number; nbPlaces: number }[],
    nbPoules: number,
    nbQualifies: number,
  ): FormatGraphePropose {
    const phase2Groupes = Array.from({ length: nbQualifies }, (_, r) => ({
      nom: `Finale rang ${r + 1}`,
      ordre: r + 1,
      nbPlaces: nbPoules,
    }));

    const liens: FormatGraphePropose['liens'] = [];
    // Rangs qualifiés → groupes de finale correspondants
    for (let rang = 1; rang <= nbQualifies; rang++) {
      for (let poule = 0; poule < nbPoules; poule++) {
        liens.push({
          phaseOrdreSource: 1,
          groupeOrdreSource: poule + 1,
          rangSource: rang,
          phaseOrdreCible: 2,
          groupeOrdreCible: rang,
          etat: 'LIE',
        });
      }
    }
    // Rangs éliminés
    for (
      let rang = nbQualifies + 1;
      rang <= (phase1Groupes[0]?.nbPlaces ?? 0);
      rang++
    ) {
      for (let poule = 0; poule < nbPoules; poule++) {
        liens.push({
          phaseOrdreSource: 1,
          groupeOrdreSource: poule + 1,
          rangSource: rang,
          phaseOrdreCible: null,
          groupeOrdreCible: null,
          etat: 'ELIMINE',
        });
      }
    }

    return {
      phases: [
        { nom: 'Brassage', ordre: 1, groupes: phase1Groupes },
        { nom: 'Finales', ordre: 2, groupes: phase2Groupes },
      ],
      liens,
    };
  }

  /**
   * CLASSEMENT_CROISE : appariement direct entre poules adjacentes par rang
   * (1er A vs 2e B, 1er B vs 2e A pour les poules A/B).
   */
  private genererClassementCroise(
    phase1Groupes: { nom: string; ordre: number; nbPlaces: number }[],
    nbPoules: number,
    nbQualifies: number,
  ): FormatGraphePropose {
    // Groupes de phase 2 : 1 groupe de 2 par paire de poules par rang qualifié
    const nbPaires = Math.floor(nbPoules / 2);
    const phase2Groupes: { nom: string; ordre: number; nbPlaces: number }[] =
      [];
    let groupeOrdre = 1;
    for (let rang = 1; rang <= nbQualifies; rang++) {
      for (let paire = 0; paire < nbPaires; paire++) {
        phase2Groupes.push({
          nom: `Match ${String.fromCharCode(65 + paire * 2)}-${String.fromCharCode(66 + paire * 2)} rang ${rang}`,
          ordre: groupeOrdre++,
          nbPlaces: 2,
        });
      }
    }

    const liens: FormatGraphePropose['liens'] = [];
    // Un rang de poule ne doit recevoir qu'un seul FormatLien (contrainte
    // @@unique([groupeSourceId, rangSource])) : le croisement pair/impair
    // peut consommer un rang au-delà de nbQualifies (ex. nbQualifies impair)
    // — ces rangs "empruntés" ne doivent pas être re-marqués ELIMINE ensuite.
    const rangsConsommes = new Set<string>();
    groupeOrdre = 1;
    for (let rang = 1; rang <= nbQualifies; rang++) {
      for (let paire = 0; paire < nbPaires; paire++) {
        const pouleA = paire * 2 + 1; // ordre de poule 1-based
        const pouleB = paire * 2 + 2;
        // rang pair: A prend rang, B prend rang+1 (croisé) ; rang impair: inverse
        const rangA = rang;
        const rangB = rang % 2 === 0 ? rang - 1 : rang + 1;
        const cibleOrdre = groupeOrdre++;
        liens.push({
          phaseOrdreSource: 1,
          groupeOrdreSource: pouleA,
          rangSource: rangA,
          phaseOrdreCible: 2,
          groupeOrdreCible: cibleOrdre,
          etat: 'LIE',
        });
        rangsConsommes.add(`${pouleA}-${rangA}`);
        if (pouleB <= nbPoules) {
          const rangBEffectif =
            rangB <= phase1Groupes[0]?.nbPlaces ? rangB : rang;
          liens.push({
            phaseOrdreSource: 1,
            groupeOrdreSource: pouleB,
            rangSource: rangBEffectif,
            phaseOrdreCible: 2,
            groupeOrdreCible: cibleOrdre,
            etat: 'LIE',
          });
          rangsConsommes.add(`${pouleB}-${rangBEffectif}`);
        }
      }
    }
    // Rangs éliminés (non qualifiés, et non déjà consommés par le croisement)
    for (
      let rang = nbQualifies + 1;
      rang <= (phase1Groupes[0]?.nbPlaces ?? 0);
      rang++
    ) {
      for (let poule = 0; poule < nbPoules; poule++) {
        if (rangsConsommes.has(`${poule + 1}-${rang}`)) continue;
        liens.push({
          phaseOrdreSource: 1,
          groupeOrdreSource: poule + 1,
          rangSource: rang,
          phaseOrdreCible: null,
          groupeOrdreCible: null,
          etat: 'ELIMINE',
        });
      }
    }

    return {
      phases: [
        { nom: 'Brassage', ordre: 1, groupes: phase1Groupes },
        { nom: 'Finales', ordre: 2, groupes: phase2Groupes },
      ],
      liens,
    };
  }

  /**
   * ELIMINATION_DIRECTE : bracket en élimination directe sur les qualifiés,
   * modélisé avec une Phase par tour (Phase 2 = demi-finales, Phase 3 = finale
   * etc.), car un Groupe ne peut pas être un bracket imbriqué (hors périmètre v1).
   */
  private genererEliminationDirecte(
    phase1Groupes: { nom: string; ordre: number; nbPlaces: number }[],
    nbPoules: number,
    nbQualifies: number,
  ): FormatGraphePropose {
    const totalQualifies = nbPoules * nbQualifies;
    // Arrondi au powerOf2 supérieur pour le bracket
    let bracket = 1;
    while (bracket < totalQualifies) bracket *= 2;

    const phases: FormatGraphePropose['phases'] = [
      { nom: 'Brassage', ordre: 1, groupes: phase1Groupes },
    ];
    const liens: FormatGraphePropose['liens'] = [];

    let currentMatchCount = bracket / 2;
    let phaseOrdre = 2;
    let prevPhaseMatchCount = 0;

    // Phase 2 : premier tour du bracket (totalQualifies/2 matches si bracket parfait)
    while (currentMatchCount >= 1) {
      const groupes = Array.from({ length: currentMatchCount }, (_, i) => ({
        nom:
          this.labelTour(currentMatchCount * 2) +
          (currentMatchCount > 1 ? ` match ${i + 1}` : ''),
        ordre: i + 1,
        nbPlaces: 2,
      }));
      phases.push({
        nom: this.labelPhase(currentMatchCount * 2),
        ordre: phaseOrdre,
        groupes,
      });

      if (phaseOrdre === 2) {
        // Phase 1 → Phase 2 : seeds des qualifiés (snake/croisé)
        const seeds = this.seedCroise(nbPoules, nbQualifies);
        for (let match = 0; match < currentMatchCount; match++) {
          const seed1 = seeds[match * 2];
          const seed2 = seeds[match * 2 + 1];
          if (seed1) {
            liens.push({
              phaseOrdreSource: 1,
              groupeOrdreSource: seed1.poule,
              rangSource: seed1.rang,
              phaseOrdreCible: 2,
              groupeOrdreCible: match + 1,
              etat: 'LIE',
            });
          }
          if (seed2) {
            liens.push({
              phaseOrdreSource: 1,
              groupeOrdreSource: seed2.poule,
              rangSource: seed2.rang,
              phaseOrdreCible: 2,
              groupeOrdreCible: match + 1,
              etat: 'LIE',
            });
          }
        }
        // Rangs éliminés (non qualifiés)
        for (
          let rang = nbQualifies + 1;
          rang <= (phase1Groupes[0]?.nbPlaces ?? 0);
          rang++
        ) {
          for (let poule = 0; poule < nbPoules; poule++) {
            liens.push({
              phaseOrdreSource: 1,
              groupeOrdreSource: poule + 1,
              rangSource: rang,
              phaseOrdreCible: null,
              groupeOrdreCible: null,
              etat: 'ELIMINE',
            });
          }
        }
      } else {
        // Tour suivant : vainqueur de chaque paire de matchs du tour précédent
        for (let match = 0; match < currentMatchCount; match++) {
          // Rang 1 (vainqueur) va vers le match suivant
          liens.push({
            phaseOrdreSource: phaseOrdre - 1,
            groupeOrdreSource: match * 2 + 1,
            rangSource: 1,
            phaseOrdreCible: phaseOrdre,
            groupeOrdreCible: match + 1,
            etat: 'LIE',
          });
          liens.push({
            phaseOrdreSource: phaseOrdre - 1,
            groupeOrdreSource: match * 2 + 2,
            rangSource: 1,
            phaseOrdreCible: phaseOrdre,
            groupeOrdreCible: match + 1,
            etat: 'LIE',
          });
          // Rang 2 (perdant) : éliminé
          liens.push({
            phaseOrdreSource: phaseOrdre - 1,
            groupeOrdreSource: match * 2 + 1,
            rangSource: 2,
            phaseOrdreCible: null,
            groupeOrdreCible: null,
            etat: 'ELIMINE',
          });
          liens.push({
            phaseOrdreSource: phaseOrdre - 1,
            groupeOrdreSource: match * 2 + 2,
            rangSource: 2,
            phaseOrdreCible: null,
            groupeOrdreCible: null,
            etat: 'ELIMINE',
          });
        }
      }

      prevPhaseMatchCount = currentMatchCount;
      currentMatchCount = currentMatchCount / 2;
      phaseOrdre++;
      if (prevPhaseMatchCount === 1) break; // finale jouée
    }

    // Rang 1 et 2 de la finale (dernière phase) sont terminaux
    const dernierPhaseOrdre = phaseOrdre - 1;
    liens.push({
      phaseOrdreSource: dernierPhaseOrdre,
      groupeOrdreSource: 1,
      rangSource: 1,
      phaseOrdreCible: null,
      groupeOrdreCible: null,
      etat: 'ELIMINE',
    });
    liens.push({
      phaseOrdreSource: dernierPhaseOrdre,
      groupeOrdreSource: 1,
      rangSource: 2,
      phaseOrdreCible: null,
      groupeOrdreCible: null,
      etat: 'ELIMINE',
    });

    return { phases, liens };
  }

  private labelTour(nbParticipants: number): string {
    if (nbParticipants <= 2) return 'Finale';
    if (nbParticipants <= 4) return 'Demi-finale';
    if (nbParticipants <= 8) return 'Quart de finale';
    return `Tour de ${nbParticipants}`;
  }

  private labelPhase(nbParticipants: number): string {
    if (nbParticipants <= 2) return 'Finale';
    if (nbParticipants <= 4) return 'Demi-finales';
    if (nbParticipants <= 8) return 'Quarts de finale';
    return `Tour de ${nbParticipants}`;
  }

  /** Seed croisé : 1ers de poule d'abord, puis 2èmes, etc. */
  private seedCroise(
    nbPoules: number,
    nbQualifies: number,
  ): Array<{ poule: number; rang: number }> {
    const seeds: Array<{ poule: number; rang: number }> = [];
    for (let rang = 1; rang <= nbQualifies; rang++) {
      for (let poule = 1; poule <= nbPoules; poule++) {
        seeds.push({ poule, rang });
      }
    }
    return seeds;
  }
}
