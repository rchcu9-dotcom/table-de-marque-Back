import { Injectable } from '@nestjs/common';
import { EquipeSimulation } from '../../domain/entities/equipe-simulation.entity';
import {
  MatchGenere,
  PhaseCompetition,
} from '../../domain/entities/match-genere.entity';
import { InscEditionJour } from '../../domain/entities/inscription-edition-jour.entity';
import { FormatPhaseFinale } from '../../domain/enums/format-phase-finale.enum';
import { NumeroMatchAllocator } from './numero-match-allocator';

export type Qualifie = {
  ref: string;
  nom: string;
  poule: string;
  rang: number;
};

type PairingBrut = {
  refA: string;
  nomA: string;
  refB: string;
  nomB: string;
  /** Ref vainqueur que ce pairing produit pour un tour suivant (bracket uniquement). */
  refVainqueurProduit?: string;
};

export type GenerationMatchsInput = {
  equipes: EquipeSimulation[];
  jours: InscEditionJour[];
  nbPoules: number;
  nbEquipesQualifieesParPoule: number;
  formatPhaseFinale: FormatPhaseFinale;
  dureeMatchPouleMin: number;
  dureeMatchFinalMin: number;
  dureeSurfacageMin: number;
  dureeInterMatchMin: number;
  nbPatinoires: number;
  allocator: NumeroMatchAllocator;
};

export type GenerationMatchsOutput = {
  matches: MatchGenere[];
  poules: Map<string, string[]>;
  qualifies: Qualifie[];
};

const POULE_CODES = 'ABCDEFGHIJKLMNOP'.split('');

@Injectable()
export class GenerationMatchsService {
  genere(input: GenerationMatchsInput): GenerationMatchsOutput {
    const {
      equipes,
      jours,
      nbPoules,
      nbEquipesQualifieesParPoule,
      formatPhaseFinale,
      dureeMatchPouleMin,
      dureeMatchFinalMin,
      dureeSurfacageMin,
      dureeInterMatchMin,
      nbPatinoires,
      allocator,
    } = input;

    const matches: MatchGenere[] = [];
    const poules = this.repartirEnPoules(equipes, nbPoules);
    const equipeParRef = new Map(equipes.map((e) => [e.ref, e]));

    // ─── Jour 1 (ou premier jour configuré) : brassage round-robin par poule ───
    const jourBrassage = jours[0] ?? null;
    const pairingsBrassage: PairingBrut[] = [];
    for (const [, membres] of poules) {
      pairingsBrassage.push(...this.roundRobinPairs(membres, equipeParRef));
    }
    if (jourBrassage) {
      matches.push(
        ...this.placerMatchsSurJour(
          pairingsBrassage,
          jourBrassage,
          'BRASSAGE',
          this.poulesParRef(poules),
          dureeMatchPouleMin,
          dureeSurfacageMin,
          dureeInterMatchMin,
          nbPatinoires,
          allocator,
        ),
      );
    }

    // ─── Qualifiés (placeholders — inconnus tant que J1 n'a pas été joué) ───
    const qualifies: Qualifie[] = [];
    for (const [pouleCode, membres] of poules) {
      const nbQualifies = Math.min(nbEquipesQualifieesParPoule, membres.length);
      for (let rang = 1; rang <= nbQualifies; rang++) {
        qualifies.push({
          ref: `placeholder:poule-${pouleCode}-rang-${rang}`,
          nom: `${rang}${rang === 1 ? 'er' : 'e'} Poule ${pouleCode}`,
          poule: pouleCode,
          rang,
        });
      }
    }

    // ─── Jours suivants : qualification / finale selon formatPhaseFinale ───
    const joursFinale = jours.slice(1);
    if (joursFinale.length > 0 && qualifies.length >= 2) {
      const pairingsFinale = this.genererPhaseFinale(
        qualifies,
        formatPhaseFinale,
      );
      matches.push(
        ...this.repartirSurPlusieursJours(
          pairingsFinale,
          joursFinale,
          formatPhaseFinale === FormatPhaseFinale.ELIMINATION_DIRECTE
            ? 'FINALE'
            : 'QUALIFICATION',
          dureeMatchFinalMin,
          dureeSurfacageMin,
          dureeInterMatchMin,
          nbPatinoires,
          allocator,
        ),
      );
    }

    return { matches, poules, qualifies };
  }

  /**
   * Dérive, pour chaque jour de qualification/finale, la liste des
   * participants attendus (ref + nom) à partir des matchs déjà placés ce
   * jour-là. Filet de sécurité (appliqué au DERNIER jour de `joursFinale`
   * uniquement) : tout qualifié qui n'apparaît dans aucun match d'aucun jour
   * de finale (formats CLASSEMENT_CROISE à nombre de poules impair,
   * POULES_FINALES à groupe de rang réduit à 1 membre — ex. tournoi à une
   * seule poule) y est tout de même rattaché, pour ne jamais perdre de repas
   * silencieusement.
   */
  participantsAttendusParJour(
    matches: MatchGenere[],
    qualifies: Qualifie[],
    joursFinale: InscEditionJour[],
  ): Map<number, { ref: string; nom: string }[]> {
    const parJour = new Map<number, { ref: string; nom: string }[]>();
    if (joursFinale.length === 0) return parJour;

    const refsCouverts = new Set<string>();

    for (const jour of joursFinale) {
      const parRef = new Map<string, string>();
      for (const m of matches) {
        if (m.jour !== jour.numeroJour) continue;
        parRef.set(m.equipe1Ref, m.equipe1Nom);
        parRef.set(m.equipe2Ref, m.equipe2Nom);
        refsCouverts.add(m.equipe1Ref);
        refsCouverts.add(m.equipe2Ref);
      }
      parJour.set(
        jour.numeroJour,
        [...parRef.entries()].map(([ref, nom]) => ({ ref, nom })),
      );
    }

    const nonCouverts = qualifies.filter((q) => !refsCouverts.has(q.ref));
    if (nonCouverts.length > 0) {
      const dernierJour = joursFinale[joursFinale.length - 1];
      const participants = parJour.get(dernierJour.numeroJour)!;
      participants.push(
        ...nonCouverts.map((q) => ({ ref: q.ref, nom: q.nom })),
      );
    }

    return parJour;
  }

  private repartirEnPoules(
    equipes: EquipeSimulation[],
    nbPoules: number,
  ): Map<string, string[]> {
    const poules = new Map<string, string[]>();
    const n = Math.max(1, Math.min(nbPoules, POULE_CODES.length));
    for (let i = 0; i < n; i++) poules.set(POULE_CODES[i], []);

    // Répartition "snake" pour équilibrer les poules.
    let idx = 0;
    let sens = 1;
    let poule = 0;
    for (const equipe of equipes) {
      poules.get(POULE_CODES[poule])!.push(equipe.ref);
      poule += sens;
      if (poule === n) {
        poule = n - 1;
        sens = -1;
      } else if (poule < 0) {
        poule = 0;
        sens = 1;
      }
      idx++;
    }
    void idx;
    return poules;
  }

  private poulesParRef(poules: Map<string, string[]>): Map<string, string> {
    const map = new Map<string, string>();
    for (const [code, membres] of poules) {
      for (const ref of membres) map.set(ref, code);
    }
    return map;
  }

  private roundRobinPairs(
    refs: string[],
    equipeParRef: Map<string, EquipeSimulation>,
  ): PairingBrut[] {
    const nomDe = (ref: string) => equipeParRef.get(ref)?.nom ?? ref;
    const pairs: PairingBrut[] = [];
    for (let i = 0; i < refs.length; i++) {
      for (let j = i + 1; j < refs.length; j++) {
        pairs.push({
          refA: refs[i],
          nomA: nomDe(refs[i]),
          refB: refs[j],
          nomB: nomDe(refs[j]),
        });
      }
    }
    return pairs;
  }

  private genererPhaseFinale(
    qualifies: Qualifie[],
    format: FormatPhaseFinale,
  ): PairingBrut[] {
    switch (format) {
      case FormatPhaseFinale.POULES_FINALES:
        return this.genererPoulesFinales(qualifies);
      case FormatPhaseFinale.CLASSEMENT_CROISE:
        return this.genererClassementCroise(qualifies);
      case FormatPhaseFinale.ELIMINATION_DIRECTE:
      default:
        return this.genererEliminationDirecte(qualifies);
    }
  }

  /** Bracket à élimination directe, seeding croisé entre poules pour éviter un même-poule dès le 1er tour. Pas de match de 3e place (simplification assumée). */
  private genererEliminationDirecte(qualifies: Qualifie[]): PairingBrut[] {
    const seeds = this.seedCroise(qualifies);
    const pairs: PairingBrut[] = [];
    let tour = 1;
    let participants: { ref: string; nom: string }[] = seeds;

    while (participants.length > 1) {
      const label = this.labelTour(participants.length);
      const suivant: { ref: string; nom: string }[] = [];
      for (let i = 0; i < participants.length; i += 2) {
        const a = participants[i];
        const b = participants[i + 1];
        if (!b) {
          // Nombre impair de qualifiés : bye, passe directement au tour suivant.
          suivant.push(a);
          continue;
        }
        const refVainqueur = `placeholder:vainqueur-t${tour}-m${i / 2 + 1}`;
        pairs.push({
          refA: a.ref,
          nomA: a.nom,
          refB: b.ref,
          nomB: b.nom,
          refVainqueurProduit: refVainqueur,
        });
        suivant.push({
          ref: refVainqueur,
          nom: `Vainqueur ${label} ${i / 2 + 1}`,
        });
      }
      participants = suivant;
      tour++;
    }
    return pairs;
  }

  private labelTour(nbParticipants: number): string {
    if (nbParticipants <= 2) return 'Finale';
    if (nbParticipants <= 4) return 'Demi-finale';
    if (nbParticipants <= 8) return 'Quart de finale';
    return `Tour de ${nbParticipants}`;
  }

  private seedCroise(qualifies: Qualifie[]): { ref: string; nom: string }[] {
    const parRang = new Map<number, Qualifie[]>();
    for (const q of qualifies) {
      if (!parRang.has(q.rang)) parRang.set(q.rang, []);
      parRang.get(q.rang)!.push(q);
    }
    const rangs = [...parRang.keys()].sort((a, b) => a - b);
    const seeded: { ref: string; nom: string }[] = [];
    // 1ers de poule d'abord (dans l'ordre des poules), puis 2èmes, etc. —
    // évite qu'un 1er et un 2e de la même poule ne se rencontrent au 1er tour
    // tant qu'il y a assez de poules distinctes.
    for (const rang of rangs) {
      for (const q of parRang.get(rang)!) {
        seeded.push({ ref: q.ref, nom: q.nom });
      }
    }
    return seeded;
  }

  /** Nouvelles poules finales par rang (tous les 1ers ensemble, tous les 2èmes ensemble, ...), round-robin. */
  private genererPoulesFinales(qualifies: Qualifie[]): PairingBrut[] {
    const parRang = new Map<number, Qualifie[]>();
    for (const q of qualifies) {
      if (!parRang.has(q.rang)) parRang.set(q.rang, []);
      parRang.get(q.rang)!.push(q);
    }
    const pairs: PairingBrut[] = [];
    for (const groupe of parRang.values()) {
      for (let i = 0; i < groupe.length; i++) {
        for (let j = i + 1; j < groupe.length; j++) {
          pairs.push({
            refA: groupe[i].ref,
            nomA: groupe[i].nom,
            refB: groupe[j].ref,
            nomB: groupe[j].nom,
          });
        }
      }
    }
    return pairs;
  }

  /** Appariement croisé direct entre poules adjacentes (1er A vs 2e B, 1er B vs 2e A, ...), un seul tour. */
  private genererClassementCroise(qualifies: Qualifie[]): PairingBrut[] {
    const poulesCodes = [...new Set(qualifies.map((q) => q.poule))].sort();
    const pairs: PairingBrut[] = [];
    for (let i = 0; i < poulesCodes.length; i += 2) {
      const codeA = poulesCodes[i];
      const codeB = poulesCodes[i + 1];
      if (!codeB) continue;
      const equipeA = qualifies.filter((q) => q.poule === codeA);
      const equipeB = qualifies.filter((q) => q.poule === codeB);
      for (let r = 0; r < Math.min(equipeA.length, equipeB.length); r++) {
        const autreRang = equipeB.find(
          (q) => q.rang === equipeA[r].rang + (r % 2 === 0 ? 1 : -1),
        );
        const adverse = autreRang ?? equipeB[equipeB.length - 1 - r];
        if (!adverse) continue;
        pairs.push({
          refA: equipeA[r].ref,
          nomA: equipeA[r].nom,
          refB: adverse.ref,
          nomB: adverse.nom,
        });
      }
    }
    return pairs;
  }

  private placerMatchsSurJour(
    pairings: PairingBrut[],
    jour: InscEditionJour,
    phase: PhaseCompetition,
    pouleParRef: Map<string, string>,
    dureeMatchMin: number,
    dureeSurfacageMin: number,
    dureeInterMatchMin: number,
    nbPatinoires: number,
    allocator: NumeroMatchAllocator,
  ): MatchGenere[] {
    const patinoires = Math.max(1, nbPatinoires || 1);
    const pas = dureeMatchMin + dureeSurfacageMin + (dureeInterMatchMin || 0);
    const is3v3 = jour.typeJournee === '3V3';

    const restants = [...pairings];
    const matches: MatchGenere[] = [];
    let vague = 0;
    let matchCase = 1;

    while (restants.length > 0) {
      const equipesUtilisees = new Set<string>();
      const debutVague = new Date(
        jour.heureDebut.getTime() + vague * pas * 60_000,
      );
      let creneauxLibres = patinoires;
      for (let i = 0; i < restants.length && creneauxLibres > 0; ) {
        const pairing = restants[i];
        if (
          equipesUtilisees.has(pairing.refA) ||
          equipesUtilisees.has(pairing.refB)
        ) {
          i++;
          continue;
        }
        equipesUtilisees.add(pairing.refA);
        equipesUtilisees.add(pairing.refB);
        restants.splice(i, 1);
        creneauxLibres--;

        const poule = pouleParRef.get(pairing.refA) ?? null;
        matches.push(
          new MatchGenere(
            allocator.suivant(is3v3),
            jour.numeroJour,
            matchCase++,
            pairing.refA,
            pairing.nomA,
            pairing.refB,
            pairing.nomB,
            debutVague,
            dureeMatchMin,
            is3v3,
            poule,
            phase,
            pairing.refVainqueurProduit ?? null,
          ),
        );
      }
      vague++;
      if (vague > pairings.length + patinoires + 5) break; // garde-fou anti-boucle infinie
    }

    return matches;
  }

  private repartirSurPlusieursJours(
    pairings: PairingBrut[],
    jours: InscEditionJour[],
    phase: PhaseCompetition,
    dureeMatchMin: number,
    dureeSurfacageMin: number,
    dureeInterMatchMin: number,
    nbPatinoires: number,
    allocator: NumeroMatchAllocator,
  ): MatchGenere[] {
    if (jours.length === 1) {
      return this.placerMatchsSurJour(
        pairings,
        jours[0],
        phase,
        new Map(),
        dureeMatchMin,
        dureeSurfacageMin,
        dureeInterMatchMin,
        nbPatinoires,
        allocator,
      );
    }
    // Plusieurs jours restants : répartit les paires à parts égales,
    // dans l'ordre de génération (les tours précoces du bracket en premier).
    const parJour = Math.ceil(pairings.length / jours.length);
    const matches: MatchGenere[] = [];
    for (let j = 0; j < jours.length; j++) {
      const tranche = pairings.slice(j * parJour, (j + 1) * parJour);
      if (tranche.length === 0) continue;
      matches.push(
        ...this.placerMatchsSurJour(
          tranche,
          jours[j],
          phase,
          new Map(),
          dureeMatchMin,
          dureeSurfacageMin,
          dureeInterMatchMin,
          nbPatinoires,
          allocator,
        ),
      );
    }
    return matches;
  }
}
