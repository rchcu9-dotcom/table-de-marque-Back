import { Inject, Injectable } from '@nestjs/common';
import {
  Equipe,
  PouleClassement,
  PouleCode,
} from '@/domain/equipe/entities/equipe.entity';
import {
  EquipeRepository,
  EQUIPE_REPOSITORY_LEGACY,
} from '@/domain/equipe/repositories/equipe.repository';
import {
  ClassementPouleEngine,
  ResultatMatchPoule,
} from '@/domain/equipe/services/classement-poule.engine';
import { MatchLiveEtat } from '@/table-de-marque/domain/enums/match-live-etat.enum';
import { PrismaService } from './prisma.service';
import {
  MatchEnrichmentService,
  TaMatchRow,
  TaEquipeRow,
} from './match-enrichment.service';
import { JourKey } from './match-enrichment.mapping';
import {
  buildTeamLogoUrl,
  normalizeKey,
  pouleDisplayName,
  toUiPouleCode,
} from './mysql-utils';

type MatchLiveRow = {
  numMatch: number;
  etat: string;
  score1Cache: number;
  score2Cache: number;
};

type GroupePoule = {
  jour: JourKey;
  equipeIds: number[];
  resultats: ResultatMatchPoule[];
  nomParEquipeId: Map<number, string>;
};

type Contexte = {
  groupesParPoule: Map<string, GroupePoule>;
  reglesTieBreak: string[] | null;
};

/**
 * Décorateur EquipeRepository (branché sur le token EQUIPE_REPOSITORY,
 * cf. persistence.module.ts) qui calcule le classement sportif en interne
 * à partir de TA_MATCHS/MatchLive, sans jamais lire ta_classement/le CSV
 * Google Sheets pour les poules de brassage (J1 A-D) et de qualification
 * round-robin (J2 E-H). Délègue au repository "legacy" injecté pour :
 * - les champs non sportifs (repas, teaser, photo, ordre) ;
 * - tout pouleCode hors périmètre (J3 carrés finaux, challenge, ou J2
 *   quand l'union-find de MatchEnrichmentService n'y détecte pas un
 *   round-robin cohérent — decisions.json#1789208955015).
 */
@Injectable()
export class ClassementInterneEquipeRepository implements EquipeRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrichment: MatchEnrichmentService,
    private readonly engine: ClassementPouleEngine,
    @Inject(EQUIPE_REPOSITORY_LEGACY)
    private readonly legacy: EquipeRepository,
  ) {}

  async findClassementByPoule(code: PouleCode): Promise<PouleClassement | null> {
    const uiCode = toUiPouleCode(String(code)) ?? String(code);
    const contexte = await this.buildContexte();
    const groupe = contexte.groupesParPoule.get(uiCode);
    if (!groupe || groupe.equipeIds.length === 0) {
      return this.legacy.findClassementByPoule(code);
    }
    return this.buildPouleClassement(uiCode, groupe, contexte);
  }

  async findClassementByTeamName(teamName: string): Promise<PouleClassement | null> {
    const contexte = await this.buildContexte();
    const target = normalizeKey(teamName);
    for (const [pouleCode, groupe] of contexte.groupesParPoule.entries()) {
      const appartient = Array.from(groupe.nomParEquipeId.values()).some(
        (nom) => normalizeKey(nom) === target,
      );
      if (appartient) {
        return this.buildPouleClassement(pouleCode, groupe, contexte);
      }
    }
    return this.legacy.findClassementByTeamName(teamName);
  }

  async findAllEquipes(): Promise<Equipe[]> {
    const contexte = await this.buildContexte();
    const legacyEquipes = await this.legacy.findAllEquipes();
    const legacyByName = new Map(
      legacyEquipes.map((e) => [normalizeKey(e.name), e]),
    );

    const internes: Equipe[] = [];
    const couvertes = new Set<string>();
    for (const [pouleCode, groupe] of contexte.groupesParPoule.entries()) {
      const classement = await this.buildPouleClassement(
        pouleCode,
        groupe,
        contexte,
        legacyByName,
      );
      classement.equipes.forEach((e) => {
        internes.push(e);
        couvertes.add(normalizeKey(e.name));
      });
    }

    const horsPerimetre = legacyEquipes.filter(
      (e) => !couvertes.has(normalizeKey(e.name)),
    );
    return [...internes, ...horsPerimetre];
  }

  async findEquipeById(id: string): Promise<Equipe | null> {
    const target = normalizeKey(id);
    const all = await this.findAllEquipes();
    return (
      all.find((eq) => normalizeKey(eq.id) === target) ??
      all.find((eq) => normalizeKey(eq.name) === target) ??
      null
    );
  }

  private async buildContexte(): Promise<Contexte> {
    const [matchRows, equipeRows, edition, matchLiveByNumMatch] =
      await this.chargerDonnees();

    const equipeById = new Map<number, TaEquipeRow>(
      equipeRows.map((r) => [
        r.ID,
        { ID: r.ID, EQUIPE: r.EQUIPE, IMAGE: r.IMAGE, CHALLENGE_SAMEDI_SQL: null },
      ]),
    );

    const jourByDate = this.enrichment.buildJourMapping(matchRows);
    const dayPouleMap = this.enrichment.buildPouleMapByDay(
      matchRows,
      jourByDate,
      equipeById,
    );

    const groupesParPoule = new Map<string, GroupePoule>();

    for (const row of matchRows) {
      if (row.NUM_MATCH > 100) continue; // 3v3 : hors périmètre du classement de poule.
      const jour = jourByDate.get(
        this.enrichment.toDateKey(this.enrichment.toMatchDate(row)),
      );
      if (jour !== 'J1' && jour !== 'J2') continue;
      if (row.EQUIPE_ID1 == null || row.EQUIPE_ID2 == null) continue; // placeholder non résolu.

      const pouleMap = jour === 'J1' ? dayPouleMap.J1 : dayPouleMap.J2;
      const pouleCode = pouleMap.get(row.NUM_MATCH);
      if (!pouleCode) continue; // union-find n'a pas su rattacher ce match (cf. decisions.json#1789208955015).

      if (!groupesParPoule.has(pouleCode)) {
        groupesParPoule.set(pouleCode, {
          jour,
          equipeIds: [],
          resultats: [],
          nomParEquipeId: new Map(),
        });
      }
      const groupe = groupesParPoule.get(pouleCode)!;

      const nomA = equipeById.get(row.EQUIPE_ID1)?.EQUIPE ?? row.EQUIPE1;
      const nomB = equipeById.get(row.EQUIPE_ID2)?.EQUIPE ?? row.EQUIPE2;
      if (!groupe.equipeIds.includes(row.EQUIPE_ID1)) {
        groupe.equipeIds.push(row.EQUIPE_ID1);
      }
      if (!groupe.equipeIds.includes(row.EQUIPE_ID2)) {
        groupe.equipeIds.push(row.EQUIPE_ID2);
      }
      groupe.nomParEquipeId.set(row.EQUIPE_ID1, nomA);
      groupe.nomParEquipeId.set(row.EQUIPE_ID2, nomB);

      const score = this.resoudreScore(
        row,
        matchLiveByNumMatch.get(row.NUM_MATCH) ?? null,
      );
      if (score) {
        groupe.resultats.push({
          equipeIdA: row.EQUIPE_ID1,
          equipeIdB: row.EQUIPE_ID2,
          scoreA: score.scoreA,
          scoreB: score.scoreB,
        });
      }
    }

    const reglesTieBreak =
      (edition?.reglesTieBreak as string[] | null | undefined) ?? null;

    return { groupesParPoule, reglesTieBreak };
  }

  private async chargerDonnees(): Promise<
    [
      TaMatchRow[],
      { ID: number; EQUIPE: string; IMAGE: string | null }[],
      { reglesTieBreak: unknown } | null,
      Map<number, MatchLiveRow>,
    ]
  > {
    const [matchRows, equipeRows, edition, matchLiveRows] = await Promise.all([
      this.prisma.$queryRaw<TaMatchRow[]>`
        SELECT NUM_MATCH, MATCH_CASE, EQUIPE1, EQUIPE2, EQUIPE_ID1, EQUIPE_ID2,
               SCORE1, SCORE2, ECART, ETAT,
               DATE_FORMAT(DATEHEURE, '%Y-%m-%d %H:%i:%s') AS DATEHEURE_SQL,
               SURFACAGE
        FROM TA_MATCHS
        WHERE SURFACAGE = 0
        ORDER BY DATEHEURE ASC, NUM_MATCH ASC
      `,
      this.prisma.$queryRaw<{ ID: number; EQUIPE: string; IMAGE: string | null }[]>`
        SELECT ID, EQUIPE, IMAGE FROM ta_equipes
      `,
      this.prisma.inscEdition.findFirst({
        where: { etape: { not: 'CREATION_NOUVEAU_TOURNOI' } },
        orderBy: { createdAt: 'desc' },
      }),
      // Lecture directe via le PrismaClient partagé (même schema.prisma que
      // TableDeMarquePrismaService) plutôt que via MatchLiveRepository/
      // MATCH_LIVE_REPOSITORY : TableDeMarqueModule importe déjà
      // PersistenceModule, donc injecter ce token ici créerait un cycle de
      // modules Nest (cf. §Arch, même raisonnement que pour InscEdition).
      this.prisma.matchLive.findMany({
        select: { numMatch: true, etat: true, score1Cache: true, score2Cache: true },
      }),
    ]);

    const matchLiveByNumMatch = new Map<number, MatchLiveRow>(
      matchLiveRows.map((row) => [row.numMatch, row]),
    );

    return [matchRows, equipeRows, edition, matchLiveByNumMatch];
  }

  private resoudreScore(
    row: TaMatchRow,
    live: MatchLiveRow | null,
  ): { scoreA: number; scoreB: number } | null {
    if (
      live &&
      (live.etat === MatchLiveEtat.EN_COURS ||
        live.etat === MatchLiveEtat.EN_PAUSE ||
        live.etat === MatchLiveEtat.TERMINE)
    ) {
      return { scoreA: live.score1Cache, scoreB: live.score2Cache };
    }
    if (this.enrichment.mapStatus(row.ETAT) === 'finished') {
      return { scoreA: row.SCORE1 ?? 0, scoreB: row.SCORE2 ?? 0 };
    }
    return null;
  }

  private async buildPouleClassement(
    pouleCode: string,
    groupe: GroupePoule,
    contexte: Contexte,
    legacyByNameParam?: Map<string, Equipe>,
  ): Promise<PouleClassement> {
    const stats = this.engine.compute(
      groupe.equipeIds,
      groupe.resultats,
      contexte.reglesTieBreak,
    );

    const legacyByName =
      legacyByNameParam ?? (await this.buildLegacyByName());

    const uiCode = toUiPouleCode(pouleCode) ?? pouleCode;
    const pouleName = pouleDisplayName(uiCode) ?? uiCode;
    const phase = this.enrichment.resolvePhase(groupe.jour, uiCode);

    const equipes = [...stats]
      .sort((a, b) => a.rang - b.rang)
      .map((s) => {
        const nom = groupe.nomParEquipeId.get(s.equipeId) ?? String(s.equipeId);
        const legacyMatch = legacyByName.get(normalizeKey(nom));
        return new Equipe(
          nom,
          nom,
          buildTeamLogoUrl(nom),
          uiCode,
          pouleName,
          s.rang,
          s.joues,
          s.victoires,
          s.nuls,
          s.defaites,
          s.points,
          s.bp,
          s.bc,
          s.diff,
          legacyMatch?.repasSamedi ?? null,
          legacyMatch?.repasDimanche ?? null,
          legacyMatch?.challengeSamedi ?? null,
          legacyMatch?.photoUrl ?? null,
          legacyMatch?.repasLundi ?? null,
          legacyMatch?.ordre ?? null,
          legacyMatch?.ordreFinal ?? null,
          legacyMatch?.teaser ?? null,
        );
      });

    return { pouleCode: uiCode, pouleName, phase, equipes };
  }

  private async buildLegacyByName(): Promise<Map<string, Equipe>> {
    const legacyEquipes = await this.legacy.findAllEquipes();
    return new Map(legacyEquipes.map((e) => [normalizeKey(e.name), e]));
  }
}
