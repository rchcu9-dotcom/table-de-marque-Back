import { Injectable } from '@nestjs/common';
import { normalizeKey } from '@/infrastructure/persistence/mysql/mysql-utils';
import { MatchGenere } from '../../domain/entities/match-genere.entity';
import { PlacementCote } from '../../domain/entities/planning-match-slot.entity';
import {
  EquipesMatch,
  PlanningMatchWriter,
} from '../../domain/repositories/planning-match-writer.repository';
import { parsePoulePlaceholder } from '../../application/services/placeholder-ref.parser';
import { PlanningSlotRole } from '../../domain/entities/planning-match-slot.entity';
import { PlanningPrismaService } from './planning-prisma.service';

type SourceMatch = { numMatch: number; role: PlanningSlotRole };

/**
 * Seule porte d'écriture sur TA_MATCHS de tout le repo (D11, décision
 * journalisée dans decisions.json). Raw SQL volontaire : le modèle Prisma
 * TaMatch et son repository (MySqlMatchRepository) restent strictement
 * lecture seule pour tous les autres usages de l'application — cette classe
 * n'est appelée que par ConfirmerPlanningUseCase (création) et par
 * PlanningPlaceholderResolverService (résolution ultérieure).
 */
@Injectable()
export class PrismaPlanningMatchWriter implements PlanningMatchWriter {
  constructor(private readonly prisma: PlanningPrismaService) {}

  async ecrireMatchs(
    matches: MatchGenere[],
    equipeIdByRef: Map<string, number>,
    editionId: number,
  ): Promise<number> {
    let count = 0;
    // Ref -> match source + rôle (VAINQUEUR/PERDANT) — seul moyen de relier
    // plus tard un PlanningMatchSlot.numMatchSource à ce match, cette info
    // n'existant qu'en mémoire pendant la génération (cf.
    // MatchGenere.refVainqueurProduit / refPerdantProduit, ce dernier
    // n'étant renseigné que pour un Groupe MATCH_UNIQUE avec un lien LIE sur
    // son rang 2 — tableau haute/basse).
    const sourceByRef = new Map<string, SourceMatch>();
    for (const match of matches) {
      if (match.refVainqueurProduit) {
        sourceByRef.set(match.refVainqueurProduit, {
          numMatch: match.numMatch,
          role: 'VAINQUEUR',
        });
      }
      if (match.refPerdantProduit) {
        sourceByRef.set(match.refPerdantProduit, {
          numMatch: match.numMatch,
          role: 'PERDANT',
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const match of matches) {
        // Refs non résolues (matchs J2/J3 à identité placeholder — "1er Poule A", etc.) :
        // EQUIPE_ID reste NULL, EQUIPE1/2 porte le libellé. Comportement déjà existant et
        // supporté par MySqlMatchRepository côté lecture (buildTeamLogoUrl retombe sur le nom).
        const equipeId1 = equipeIdByRef.get(match.equipe1Ref) ?? null;
        const equipeId2 = equipeIdByRef.get(match.equipe2Ref) ?? null;

        await tx.$executeRaw`
          INSERT INTO TA_MATCHS
            (NUM_MATCH, MATCH_CASE, EQUIPE1, EQUIPE2, EQUIPE_ID1, EQUIPE_ID2,
             SCORE1, SCORE2, ETAT, DATEHEURE, SURFACAGE, ECART, NB_PHOTOS)
          VALUES
            (${match.numMatch}, ${match.matchCase}, ${match.equipe1Nom}, ${match.equipe2Nom},
             ${equipeId1}, ${equipeId2}, NULL, NULL, '', ${match.dateHeure}, 0, '', 0)
          ON DUPLICATE KEY UPDATE
            MATCH_CASE = VALUES(MATCH_CASE),
            EQUIPE1 = VALUES(EQUIPE1),
            EQUIPE2 = VALUES(EQUIPE2),
            EQUIPE_ID1 = VALUES(EQUIPE_ID1),
            EQUIPE_ID2 = VALUES(EQUIPE_ID2),
            DATEHEURE = VALUES(DATEHEURE)
        `;
        count += 1;

        // Slots de placeholder (spec "lors-du-déroulement-live..." §2) : un
        // côté non résolu à la confirmation devient une ligne planning_match_slots,
        // dans la même transaction que l'écriture du match qui la porte.
        await this.creerSlotSiPlaceholder(
          tx,
          editionId,
          match.numMatch,
          1,
          match.equipe1Ref,
          match.equipe1Nom,
          equipeId1,
          sourceByRef,
        );
        await this.creerSlotSiPlaceholder(
          tx,
          editionId,
          match.numMatch,
          2,
          match.equipe2Ref,
          match.equipe2Nom,
          equipeId2,
          sourceByRef,
        );
      }
    });
    return count;
  }

  private async creerSlotSiPlaceholder(
    tx: Parameters<Parameters<PlanningPrismaService['$transaction']>[0]>[0],
    editionId: number,
    numMatch: number,
    cote: PlacementCote,
    ref: string,
    libellePlaceholder: string,
    equipeIdResolu: number | null,
    sourceByRef: Map<string, SourceMatch>,
  ): Promise<void> {
    if (equipeIdResolu != null) return; // côté déjà résolu, pas de slot nécessaire

    const poule = parsePoulePlaceholder(ref);
    const source = sourceByRef.get(ref);

    await tx.planningMatchSlot.upsert({
      where: { numMatch_cote: { numMatch, cote } },
      update: {},
      create: {
        editionId,
        numMatch,
        cote,
        ref,
        libellePlaceholder,
        numMatchSource: source?.numMatch ?? null,
        pouleCode: poule?.pouleCode ?? null,
        rangPoule: poule?.rangPoule ?? null,
        role: source?.role ?? 'VAINQUEUR',
      },
    });
  }

  async resoudreSlot(
    numMatch: number,
    cote: PlacementCote,
    equipeId: number,
    equipeNom: string,
  ): Promise<void> {
    if (cote === 1) {
      await this.prisma.$executeRaw`
        UPDATE TA_MATCHS SET EQUIPE_ID1 = ${equipeId}, EQUIPE1 = ${equipeNom}
        WHERE NUM_MATCH = ${numMatch}
      `;
    } else {
      await this.prisma.$executeRaw`
        UPDATE TA_MATCHS SET EQUIPE_ID2 = ${equipeId}, EQUIPE2 = ${equipeNom}
        WHERE NUM_MATCH = ${numMatch}
      `;
    }
  }

  async trouverEquipesMatch(numMatch: number): Promise<EquipesMatch | null> {
    const match = await this.prisma.taMatch.findUnique({
      where: { numMatch },
      select: {
        equipeId1: true,
        equipeId2: true,
        equipe1: true,
        equipe2: true,
      },
    });
    if (!match) return null;
    return {
      equipeId1: match.equipeId1,
      equipeId2: match.equipeId2,
      equipe1Nom: match.equipe1,
      equipe2Nom: match.equipe2,
    };
  }

  async trouverEquipeIdParNom(nom: string): Promise<number | null> {
    const cible = normalizeKey(nom);
    const equipes = await this.prisma.taEquipe.findMany({
      select: { id: true, equipe: true },
    });
    const trouvee = equipes.find((e) => normalizeKey(e.equipe) === cible);
    return trouvee?.id ?? null;
  }

  async trouverEquipeNomParId(equipeId: number): Promise<string | null> {
    const equipe = await this.prisma.taEquipe.findUnique({
      where: { id: equipeId },
      select: { equipe: true },
    });
    return equipe?.equipe ?? null;
  }
}
