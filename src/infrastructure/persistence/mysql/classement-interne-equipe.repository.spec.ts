import { Equipe } from '@/domain/equipe/entities/equipe.entity';
import { EquipeRepository } from '@/domain/equipe/repositories/equipe.repository';
import { ClassementPouleEngine } from '@/domain/equipe/services/classement-poule.engine';
import { ClassementInterneEquipeRepository } from './classement-interne-equipe.repository';
import { MatchEnrichmentService, TaMatchRow } from './match-enrichment.service';
import { PrismaService } from './prisma.service';

type TaEquipeRow = { ID: number; EQUIPE: string; IMAGE: string | null };
type MatchLiveRow = {
  numMatch: number;
  etat: string;
  score1Cache: number;
  score2Cache: number;
};

const matchRow = (overrides: Partial<TaMatchRow> = {}): TaMatchRow => ({
  NUM_MATCH: 1,
  MATCH_CASE: 1,
  EQUIPE1: 'Aigles',
  EQUIPE2: 'Loups',
  EQUIPE_ID1: 1,
  EQUIPE_ID2: 2,
  SCORE1: 0,
  SCORE2: 0,
  ECART: null,
  ETAT: '',
  DATEHEURE_SQL: '2026-05-23 09:00:00',
  SURFACAGE: 0,
  ...overrides,
});

const equipeRows: TaEquipeRow[] = [
  { ID: 1, EQUIPE: 'Aigles', IMAGE: null },
  { ID: 2, EQUIPE: 'Loups', IMAGE: null },
  { ID: 3, EQUIPE: 'Ours', IMAGE: null },
];

function makeLegacyEquipe(overrides: Partial<Equipe> = {}): Equipe {
  const nom = overrides.name ?? overrides.id ?? 'Equipe';
  return new Equipe(
    overrides.id ?? nom,
    nom,
    overrides.logoUrl ?? null,
    overrides.pouleCode ?? 'A',
    overrides.pouleName ?? 'Poule A',
    overrides.rang ?? 0,
    overrides.joues ?? 0,
    overrides.victoires ?? 0,
    overrides.nuls ?? 0,
    overrides.defaites ?? 0,
    overrides.points ?? 0,
    overrides.bp ?? 0,
    overrides.bc ?? 0,
    overrides.diff ?? 0,
    overrides.repasSamedi ?? null,
    overrides.repasDimanche ?? null,
    overrides.challengeSamedi ?? null,
    overrides.photoUrl ?? null,
    overrides.repasLundi ?? null,
    overrides.ordre ?? null,
    overrides.ordreFinal ?? null,
    overrides.teaser ?? null,
  );
}

function buildRepo(options: {
  matchRows: TaMatchRow[];
  equipeRowsOverride?: TaEquipeRow[];
  edition?: { reglesTieBreak: unknown } | null;
  matchLiveRows?: MatchLiveRow[];
  legacy?: Partial<Record<keyof EquipeRepository, jest.Mock>>;
}) {
  const queryRaw = jest
    .fn()
    .mockResolvedValueOnce(options.matchRows)
    .mockResolvedValueOnce(options.equipeRowsOverride ?? equipeRows);

  const prisma = {
    $queryRaw: queryRaw,
    inscEdition: {
      findFirst: jest.fn().mockResolvedValue(options.edition ?? null),
    },
    matchLive: {
      findMany: jest.fn().mockResolvedValue(options.matchLiveRows ?? []),
    },
  } as unknown as PrismaService;

  const legacy: jest.Mocked<EquipeRepository> = {
    findClassementByPoule: jest.fn().mockResolvedValue(null),
    findClassementByTeamName: jest.fn().mockResolvedValue(null),
    findAllEquipes: jest.fn().mockResolvedValue([]),
    findEquipeById: jest.fn().mockResolvedValue(null),
    ...options.legacy,
  } as unknown as jest.Mocked<EquipeRepository>;

  const repo = new ClassementInterneEquipeRepository(
    prisma,
    new MatchEnrichmentService(),
    new ClassementPouleEngine(),
    legacy,
  );

  return { repo, prisma, legacy, queryRaw };
}

describe('ClassementInterneEquipeRepository', () => {
  // Poule à 3 équipes (union-find sur TA_MATCHS) : match 1 terminé (TA_MATCHS.ETAT='x'),
  // match 2 en cours (score porté par MatchLive, pas encore par TA_MATCHS.ETAT),
  // match 3 pas encore commencé (ni TA_MATCHS ni MatchLive) -> exclu du calcul.
  const matchesPouleA: TaMatchRow[] = [
    matchRow({
      NUM_MATCH: 1,
      EQUIPE1: 'Aigles',
      EQUIPE2: 'Loups',
      EQUIPE_ID1: 1,
      EQUIPE_ID2: 2,
      SCORE1: 2,
      SCORE2: 1,
      ETAT: 'x',
      DATEHEURE_SQL: '2026-05-23 09:00:00',
    }),
    matchRow({
      NUM_MATCH: 2,
      EQUIPE1: 'Aigles',
      EQUIPE2: 'Ours',
      EQUIPE_ID1: 1,
      EQUIPE_ID2: 3,
      SCORE1: 0,
      SCORE2: 0,
      ETAT: '',
      DATEHEURE_SQL: '2026-05-23 10:00:00',
    }),
    matchRow({
      NUM_MATCH: 3,
      EQUIPE1: 'Loups',
      EQUIPE2: 'Ours',
      EQUIPE_ID1: 2,
      EQUIPE_ID2: 3,
      SCORE1: 0,
      SCORE2: 0,
      ETAT: '',
      DATEHEURE_SQL: '2026-05-23 11:00:00',
    }),
  ];
  const matchLiveEnCours: MatchLiveRow[] = [
    { numMatch: 2, etat: 'EN_COURS', score1Cache: 1, score2Cache: 1 },
  ];

  describe('findClassementByPoule — poule interne (J1 A-D)', () => {
    it('calcule le classement depuis TA_MATCHS/MatchLive sans lire le repository legacy pour le classement sportif', async () => {
      const { repo, legacy } = buildRepo({
        matchRows: matchesPouleA,
        matchLiveRows: matchLiveEnCours,
      });

      const result = await repo.findClassementByPoule('A');

      expect(result).not.toBeNull();
      expect(result?.pouleCode).toBe('A');
      expect(result?.phase).toBe('brassage');
      expect(legacy.findClassementByPoule).not.toHaveBeenCalled();

      const parNom = new Map(result!.equipes.map((e) => [e.name, e]));
      // Aigles : victoire 2-1 sur Loups (pts2) + nul 1-1 (live) contre Ours (pts1) = 3pts.
      expect(parNom.get('Aigles')).toMatchObject({
        joues: 2,
        victoires: 1,
        nuls: 1,
        defaites: 0,
        points: 3,
        bp: 3,
        bc: 2,
        diff: 1,
        rang: 1,
      });
      // Ours : nul 1-1 (live) contre Aigles, match contre Loups pas commencé (exclu).
      expect(parNom.get('Ours')).toMatchObject({
        joues: 1,
        victoires: 0,
        nuls: 1,
        defaites: 0,
        points: 1,
        bp: 1,
        bc: 1,
        diff: 0,
        rang: 2,
      });
      // Loups : défaite 1-2 contre Aigles, match contre Ours pas commencé (exclu).
      expect(parNom.get('Loups')).toMatchObject({
        joues: 1,
        victoires: 0,
        nuls: 0,
        defaites: 1,
        points: 0,
        bp: 1,
        bc: 2,
        diff: -1,
        rang: 3,
      });
    });

    it('un match EN_PAUSE compte aussi comme joué (score MatchLive utilisé)', async () => {
      const { repo } = buildRepo({
        matchRows: matchesPouleA,
        matchLiveRows: [
          { numMatch: 2, etat: 'EN_PAUSE', score1Cache: 4, score2Cache: 0 },
        ],
      });

      const result = await repo.findClassementByPoule('A');
      const aigles = result!.equipes.find((e) => e.name === 'Aigles')!;

      expect(aigles.joues).toBe(2);
      expect(aigles.bp).toBe(2 + 4); // victoire 2-1 + victoire live 4-0
    });

    it("un match ni terminé ni live n'est pas compté comme joué", async () => {
      const { repo } = buildRepo({ matchRows: matchesPouleA, matchLiveRows: [] });

      const result = await repo.findClassementByPoule('A');
      const ours = result!.equipes.find((e) => e.name === 'Ours')!;
      const loups = result!.equipes.find((e) => e.name === 'Loups')!;

      // Sans MatchLive, seul le match 1 (terminé) compte : Ours et Loups
      // n'ont chacun qu'un seul match non résolu (Ours-Loups) qui reste exclu.
      expect(ours.joues).toBe(0);
      expect(loups.joues).toBe(1);
    });

    it('applique reglesTieBreak lu depuis ta_edition (InscEdition) plutôt que le tri par défaut', async () => {
      // Aigles et Loups ont chacun 2pts (1 victoire). Sous le tie-break par
      // défaut (points -> difference_buts -> ...), Aigles passe devant Loups
      // (diff +2 > +1). Avec reglesTieBreak=['buts_marques'] uniquement (qui
      // ignore points/diff), Loups passe devant Aigles (bp 5 > bp 2) : les
      // deux ordres sont opposés, ce qui prouve que le classement lit bien
      // reglesTieBreak depuis ta_edition plutôt que d'utiliser le tri par défaut.
      const rows: TaMatchRow[] = [
        matchRow({
          NUM_MATCH: 1,
          EQUIPE1: 'Aigles',
          EQUIPE2: 'Ours',
          EQUIPE_ID1: 1,
          EQUIPE_ID2: 3,
          SCORE1: 2,
          SCORE2: 0,
          ETAT: 'x',
        }),
        matchRow({
          NUM_MATCH: 2,
          EQUIPE1: 'Loups',
          EQUIPE2: 'Ours',
          EQUIPE_ID1: 2,
          EQUIPE_ID2: 3,
          SCORE1: 5,
          SCORE2: 4,
          ETAT: 'x',
          DATEHEURE_SQL: '2026-05-23 10:00:00',
        }),
      ];

      const { repo: repoDefaut } = buildRepo({ matchRows: rows, edition: null });
      const resultDefaut = await repoDefaut.findClassementByPoule('A');
      const rangsDefaut = new Map(
        resultDefaut!.equipes.map((e) => [e.name, e.rang]),
      );
      expect(rangsDefaut.get('Aigles')).toBeLessThan(rangsDefaut.get('Loups')!);

      const { repo: repoCustom } = buildRepo({
        matchRows: rows,
        edition: { reglesTieBreak: ['buts_marques'] },
      });
      const resultCustom = await repoCustom.findClassementByPoule('A');
      const rangsCustom = new Map(
        resultCustom!.equipes.map((e) => [e.name, e.rang]),
      );
      expect(rangsCustom.get('Loups')).toBeLessThan(rangsCustom.get('Aigles')!);
    });

    it('fusionne les champs non sportifs (repas, teaser, photo, ordre) depuis le repository legacy par nom d\'équipe', async () => {
      const legacyAigles = makeLegacyEquipe({
        id: 'Aigles',
        name: 'Aigles',
        repasSamedi: '2026-05-23T12:00:00',
        teaser: 'Favoris du tournoi',
        photoUrl: 'https://example.test/aigles.jpg',
        ordre: 7,
      });
      const { repo } = buildRepo({
        matchRows: matchesPouleA,
        matchLiveRows: matchLiveEnCours,
        legacy: {
          findAllEquipes: jest.fn().mockResolvedValue([legacyAigles]),
        },
      });

      const result = await repo.findClassementByPoule('A');
      const aigles = result!.equipes.find((e) => e.name === 'Aigles')!;

      expect(aigles.repasSamedi).toBe('2026-05-23T12:00:00');
      expect(aigles.teaser).toBe('Favoris du tournoi');
      expect(aigles.photoUrl).toBe('https://example.test/aigles.jpg');
      expect(aigles.ordre).toBe(7);
      // Les champs sportifs, eux, restent ceux calculés en interne (pas ceux du legacy).
      expect(aigles.points).toBe(3);
    });
  });

  describe('findClassementByPoule — hors périmètre (délégation au legacy)', () => {
    it('délègue intégralement pour un pouleCode J3 non détecté par l\'union-find (ex: "I")', async () => {
      const legacyResult = {
        pouleCode: 'I',
        pouleName: 'Carré Or 1',
        equipes: [makeLegacyEquipe({ id: 'Finaliste', name: 'Finaliste' })],
      };
      const { repo, legacy } = buildRepo({
        matchRows: matchesPouleA,
        legacy: {
          findClassementByPoule: jest.fn().mockResolvedValue(legacyResult),
        },
      });

      const result = await repo.findClassementByPoule('I');

      expect(legacy.findClassementByPoule).toHaveBeenCalledWith('I');
      expect(result).toBe(legacyResult);
    });
  });

  describe('findClassementByTeamName', () => {
    it('retrouve la poule interne à partir du nom d\'équipe', async () => {
      const { repo, legacy } = buildRepo({
        matchRows: matchesPouleA,
        matchLiveRows: matchLiveEnCours,
      });

      const result = await repo.findClassementByTeamName('ours');

      expect(result?.pouleCode).toBe('A');
      expect(legacy.findClassementByTeamName).not.toHaveBeenCalled();
    });

    it('délègue au legacy si le nom ne correspond à aucune équipe interne', async () => {
      const legacyResult = {
        pouleCode: 'CHALL',
        pouleName: 'Challenge',
        equipes: [],
      };
      const { repo, legacy } = buildRepo({
        matchRows: matchesPouleA,
        legacy: {
          findClassementByTeamName: jest.fn().mockResolvedValue(legacyResult),
        },
      });

      const result = await repo.findClassementByTeamName('Équipe Fantôme');

      expect(legacy.findClassementByTeamName).toHaveBeenCalledWith('Équipe Fantôme');
      expect(result).toBe(legacyResult);
    });
  });

  describe('findAllEquipes', () => {
    it('combine les équipes calculées en interne et les équipes legacy hors périmètre, sans doublon', async () => {
      const legacyHorsPerimetre = makeLegacyEquipe({
        id: 'Finaliste J3',
        name: 'Finaliste J3',
        pouleCode: 'I',
      });
      const legacyAigles = makeLegacyEquipe({ id: 'Aigles', name: 'Aigles' });
      const { repo } = buildRepo({
        matchRows: matchesPouleA,
        matchLiveRows: matchLiveEnCours,
        legacy: {
          findAllEquipes: jest
            .fn()
            .mockResolvedValue([legacyAigles, legacyHorsPerimetre]),
        },
      });

      const result = await repo.findAllEquipes();
      const noms = result.map((e) => e.name);

      expect(noms).toEqual(
        expect.arrayContaining(['Aigles', 'Loups', 'Ours', 'Finaliste J3']),
      );
      // Une seule entrée "Aigles" : la version interne (calculée), pas de doublon avec le legacy.
      expect(noms.filter((n) => n === 'Aigles')).toHaveLength(1);
      expect(result.find((e) => e.name === 'Aigles')?.points).toBe(3);
    });
  });

  describe('findEquipeById', () => {
    it('retrouve une équipe interne par son identifiant (nom)', async () => {
      const { repo } = buildRepo({
        matchRows: matchesPouleA,
        matchLiveRows: matchLiveEnCours,
      });

      const result = await repo.findEquipeById('Aigles');

      expect(result?.name).toBe('Aigles');
      expect(result?.points).toBe(3);
    });

    it('retourne null si aucune équipe (interne ou legacy) ne correspond', async () => {
      const { repo } = buildRepo({ matchRows: matchesPouleA });

      const result = await repo.findEquipeById('Inconnue');

      expect(result).toBeNull();
    });
  });
});
