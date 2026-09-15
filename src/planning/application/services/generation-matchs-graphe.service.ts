import { Injectable } from '@nestjs/common';
import { InscEditionJour } from '../../domain/entities/inscription-edition-jour.entity';
import {
  MatchGenere,
  PhaseCompetition,
} from '../../domain/entities/match-genere.entity';
import { EquipeSimulation } from '../../domain/entities/equipe-simulation.entity';
import { FormatGraphe } from '../../domain/entities/format/format-graphe.entity';
import { mecaniqueGroupe } from '../../domain/entities/format/format-groupe.entity';
import { NumeroMatchAllocator } from './numero-match-allocator';
import { GenerationMatchsOutput, Qualifie } from './generation-matchs.service';

export type GenerationMatchsGrapheInput = {
  graphe: FormatGraphe;
  equipes: EquipeSimulation[];
  joursParPhase: Map<number, InscEditionJour[]>;
  dureeMatchPouleMin: number;
  dureeMatchFinalMin: number;
  dureeSurfacageMin: number;
  dureeInterMatchMin: number;
  nbPatinoires: number;
  allocator: NumeroMatchAllocator;
};

type PairingBrut = {
  refA: string;
  nomA: string;
  refB: string;
  nomB: string;
  refVainqueurProduit?: string;
  refPerdantProduit?: string;
};

const POULE_CODES = 'ABCDEFGHIJKLMNOP'.split('');

@Injectable()
export class GenerationMatchsGrapheService {
  genere(input: GenerationMatchsGrapheInput): GenerationMatchsOutput {
    const {
      graphe,
      equipes,
      joursParPhase,
      dureeMatchPouleMin,
      dureeMatchFinalMin,
      dureeSurfacageMin,
      dureeInterMatchMin,
      nbPatinoires,
      allocator,
    } = input;

    const matches: MatchGenere[] = [];
    const poules = new Map<string, string[]>();
    const qualifies: Qualifie[] = [];

    // Trie les phases par ordre
    const phasesTriees = [...graphe.phases].sort((a, b) => a.ordre - b.ordre);

    // Affectation d'un allocateur de code de poule global (pas juste pour la Phase 1)
    let pouleCodeIdx = 0;

    // Map groupeId → code de poule alloué (uniquement si CHAMPIONNAT)
    const pouleParGroupe = new Map<number, string>();

    // Map groupeId → refs résolues (équipes affectées au groupe)
    const refsParGroupe = new Map<
      number,
      Array<{ ref: string; nom: string }>
    >();

    // Phase 1 : affecte les équipes aux places ALIAS positionellement
    const phase1 = phasesTriees[0];
    if (phase1) {
      const groupesPhase1 = graphe.groupes
        .filter((g) => g.phaseId === phase1.id)
        .sort((a, b) => a.ordre - b.ordre);

      let equipeIdx = 0;
      for (const groupe of groupesPhase1) {
        const refsGroupe: Array<{ ref: string; nom: string }> = [];
        const placesTriees = [...groupe.places].sort(
          (a, b) => a.position - b.position,
        );
        for (let _i = 0; _i < placesTriees.length; _i++) {
          const equipe = equipes[equipeIdx++];
          if (equipe) {
            refsGroupe.push({ ref: equipe.ref, nom: equipe.nom });
          }
        }
        refsParGroupe.set(groupe.id, refsGroupe);
      }
    }

    // Parcours des phases dans l'ordre
    for (const phase of phasesTriees) {
      const joursPhase = joursParPhase.get(phase.id) ?? [];
      const groupesPhase = graphe.groupes
        .filter((g) => g.phaseId === phase.id)
        .sort((a, b) => a.ordre - b.ordre);

      for (const groupe of groupesPhase) {
        const refsGroupe = refsParGroupe.get(groupe.id) ?? [];
        if (refsGroupe.length < 2) continue;

        const mecanique = mecaniqueGroupe(groupe);

        if (mecanique === 'RONDE_SUISSE') {
          throw new Error(
            `La formule "Ronde suisse" n'est pas encore prise en charge par la génération ` +
              `automatique du planning (groupe "${groupe.nom}", id=${groupe.id}). ` +
              `Configurez ce groupe en "Championnat" en attendant.`,
          );
        }

        if (mecanique === 'CHAMPIONNAT') {
          // Alloue un code de poule
          const pouleCode = POULE_CODES[pouleCodeIdx % POULE_CODES.length];
          pouleCodeIdx++;
          pouleParGroupe.set(groupe.id, pouleCode);
          poules.set(
            pouleCode,
            refsGroupe.map((r) => r.ref),
          );

          const equipeParRef = new Map(equipes.map((e) => [e.ref, e]));
          const pairings = this.roundRobinPairs(refsGroupe, equipeParRef);
          const pouleParRef = new Map<string, string>();
          for (const { ref } of refsGroupe) pouleParRef.set(ref, pouleCode);

          const phase1Label: PhaseCompetition =
            phase.ordre === 1
              ? 'BRASSAGE'
              : phase.ordre === phasesTriees.length
                ? 'FINALE'
                : 'QUALIFICATION';

          for (const jour of joursPhase.length > 0 ? joursPhase : []) {
            matches.push(
              ...this.placerMatchsSurJour(
                pairings,
                jour,
                phase1Label,
                pouleParRef,
                dureeMatchPouleMin,
                dureeSurfacageMin,
                dureeInterMatchMin,
                nbPatinoires,
                allocator,
                groupe.id,
              ),
            );
          }

          // Génère les qualifiés pour les rangs LIE vers le groupe cible
          const liensGroupe = graphe.liens
            .filter((l) => l.groupeSourceId === groupe.id && l.etat === 'LIE')
            .sort((a, b) => a.rangSource - b.rangSource);

          for (const lien of liensGroupe) {
            qualifies.push({
              ref: `placeholder:groupe-${groupe.id}-rang-${lien.rangSource}`,
              nom: `${lien.rangSource}${lien.rangSource === 1 ? 'er' : 'e'} Groupe ${groupe.nom}`,
              poule: pouleCode,
              rang: lien.rangSource,
            });
          }

          // Propage vers groupes cibles
          for (const lien of liensGroupe) {
            if (lien.groupeCibleId != null) {
              const refsExistants = refsParGroupe.get(lien.groupeCibleId) ?? [];
              refsExistants.push({
                ref: `placeholder:groupe-${groupe.id}-rang-${lien.rangSource}`,
                nom: `${lien.rangSource}${lien.rangSource === 1 ? 'er' : 'e'} Groupe ${groupe.nom}`,
              });
              refsParGroupe.set(lien.groupeCibleId, refsExistants);
            }
          }
        } else {
          // MATCH_UNIQUE : une seule paire
          if (refsGroupe.length < 2) continue;
          const a = refsGroupe[0];
          const b = refsGroupe[1];

          const refVainqueur = `placeholder:groupe-${groupe.id}-rang-1`;
          const refPerdant = `placeholder:groupe-${groupe.id}-rang-2`;

          const pairing: PairingBrut = {
            refA: a.ref,
            nomA: a.nom,
            refB: b.ref,
            nomB: b.nom,
            refVainqueurProduit: refVainqueur,
            refPerdantProduit: refPerdant,
          };

          const phaseLabel: PhaseCompetition =
            phase.ordre === phasesTriees.length ? 'FINALE' : 'QUALIFICATION';

          for (const jour of joursPhase.length > 0 ? joursPhase : []) {
            matches.push(
              ...this.placerMatchsSurJour(
                [pairing],
                jour,
                phaseLabel,
                new Map(),
                dureeMatchFinalMin,
                dureeSurfacageMin,
                dureeInterMatchMin,
                nbPatinoires,
                allocator,
                groupe.id,
              ),
            );
          }

          // Propage vainqueur et perdant vers groupes cibles
          const liensGroupe = graphe.liens
            .filter((l) => l.groupeSourceId === groupe.id)
            .sort((a, b) => a.rangSource - b.rangSource);

          for (const lien of liensGroupe) {
            if (lien.etat !== 'LIE' || lien.groupeCibleId == null) continue;
            const ref = lien.rangSource === 1 ? refVainqueur : refPerdant;
            const nom =
              lien.rangSource === 1
                ? `Vainqueur Groupe ${groupe.nom}`
                : `Perdant Groupe ${groupe.nom}`;
            const refsExistants = refsParGroupe.get(lien.groupeCibleId) ?? [];
            refsExistants.push({ ref, nom });
            refsParGroupe.set(lien.groupeCibleId, refsExistants);
          }
        }
      }
    }

    return { matches, poules, qualifies };
  }

  /**
   * Calcule les participants attendus par jour de phase (pour le placement
   * des repas — même contrat que GenerationMatchsService).
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
      const participants = parJour.get(dernierJour.numeroJour) ?? [];
      participants.push(
        ...nonCouverts.map((q) => ({ ref: q.ref, nom: q.nom })),
      );
      parJour.set(dernierJour.numeroJour, participants);
    }

    return parJour;
  }

  private roundRobinPairs(
    refs: Array<{ ref: string; nom: string }>,
    equipeParRef: Map<string, EquipeSimulation>,
  ): PairingBrut[] {
    const nomDe = (ref: string) => equipeParRef.get(ref)?.nom ?? ref;
    const pairs: PairingBrut[] = [];
    for (let i = 0; i < refs.length; i++) {
      for (let j = i + 1; j < refs.length; j++) {
        pairs.push({
          refA: refs[i].ref,
          nomA: nomDe(refs[i].ref) || refs[i].nom,
          refB: refs[j].ref,
          nomB: nomDe(refs[j].ref) || refs[j].nom,
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
    groupeId: number,
  ): MatchGenere[] {
    const patinoires = Math.max(1, nbPatinoires || 1);
    const pas = dureeMatchMin + dureeSurfacageMin + (dureeInterMatchMin || 0);
    const is3v3 = jour.typeJournee === '3V3';

    const restants = [...pairings];
    const matchesResult: MatchGenere[] = [];
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
        matchesResult.push(
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
            groupeId,
            pairing.refPerdantProduit ?? null,
          ),
        );
      }
      vague++;
      if (vague > pairings.length + patinoires + 5) break;
    }

    return matchesResult;
  }
}
