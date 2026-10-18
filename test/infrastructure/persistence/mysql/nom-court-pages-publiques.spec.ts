import { MySqlChallengeGardienJ3Repository } from '@/infrastructure/persistence/mysql/mysql-challenge-gardien-j3.repository';
import { MySqlChallengeJ1MomentumRepository } from '@/infrastructure/persistence/mysql/mysql-challenge-j1-momentum.repository';
import { MySqlChallengeVitesseJ3Repository } from '@/infrastructure/persistence/mysql/mysql-challenge-vitesse-j3.repository';
import { MySqlEquipeRepository } from '@/infrastructure/persistence/mysql/mysql-equipe.repository';
import { MySqlMatchRepository } from '@/infrastructure/persistence/mysql/mysql-match.repository';
import { MatchEnrichmentService } from '@/infrastructure/persistence/mysql/match-enrichment.service';
import { PrismaService } from '@/infrastructure/persistence/mysql/prisma.service';

// docs/specs/-impact-sur-les-pages-publiques-contexte-les-pages-publiques.md — §1, §4, CA1 à CA3
// Les pages publiques lisent ta_equipes.EQUIPE (le nom court) : c'est lui qui sert de nom
// affiché, d'identifiant et de source du logo. Ces tests verrouillent ce que renvoient
// les dépôts MySQL pour une équipe « Courbevoie ».

const BASE = 'https://cdn.local/logos';

/** Prisma simulé : chaque appel à $queryRaw renvoie le jeu de lignes suivant. */
function prisma(...jeux: unknown[][]): PrismaService {
  const queryRaw = jest.fn();
  for (const jeu of jeux) queryRaw.mockResolvedValueOnce(jeu);
  queryRaw.mockResolvedValue([]);
  return { $queryRaw: queryRaw } as unknown as PrismaService;
}

describe('Pages publiques — nom court et logo depuis ta_equipes.EQUIPE', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup, TEAM_LOGO_BASE_URL: BASE };
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = envBackup;
  });

  describe('MySqlEquipeRepository (classement, équipes)', () => {
    const classement = {
      GROUPE_NOM: '1',
      ORDRE: 1,
      ORDRE_FINAL: 1,
      EQUIPE: 'Courbevoie',
      EQUIPE_ID: 12,
      J: 2,
      V: 1,
      N: 0,
      D: 1,
      PTS: 3,
      BP: 2,
      BC: 2,
      DIFF: 0,
      REPAS_SAMEDI: null,
      REPAS_DIMANCHE: null,
      REPAS_LUNDI: null,
      CHALLENGE_SAMEDI: null,
    };

    it('expose le nom court comme identifiant, comme nom affiché et comme source du logo', async () => {
      const repo = new MySqlEquipeRepository(
        prisma(
          [classement],
          [{ ID: 12, EQUIPE: 'Courbevoie', IMAGE: 'courbevoie.png' }],
        ),
      );

      const poule = await repo.findClassementByPoule('E');
      const equipe = poule!.equipes[0];

      expect(equipe.id).toBe('Courbevoie');
      expect(equipe.name).toBe('Courbevoie');
      expect(equipe.logoUrl).toBe(`${BASE}/courbevoie.png`);
      expect(equipe).not.toHaveProperty('nomComplet');
    });

    it('ne se sert pas de la colonne IMAGE (legacy) pour le logo', async () => {
      const repo = new MySqlEquipeRepository(
        prisma(
          [{ ...classement, EQUIPE: 'Le Havre' }],
          [{ ID: 12, EQUIPE: 'Le Havre', IMAGE: 'lehavre.png' }],
        ),
      );

      const equipe = (await repo.findClassementByPoule('E'))!.equipes[0];

      expect(equipe.logoUrl).toBe(`${BASE}/le-havre.png`);
    });

    it.each([
      ['Orléans', 'orleans'],
      ['Dammarie/Cergy', 'dammarie-cergy'],
      ['Amical 1', 'amical-1'],
    ])('« %s » : nom affiché inchangé, logo %s.png', async (nom, slug) => {
      const repo = new MySqlEquipeRepository(
        prisma([{ ...classement, EQUIPE: nom }], []),
      );

      const equipe = (await repo.findClassementByPoule('E'))!.equipes[0];

      expect(equipe.name).toBe(nom);
      expect(equipe.id).toBe(nom);
      expect(equipe.logoUrl).toBe(`${BASE}/${slug}.png`);
    });
  });

  describe('MySqlMatchRepository (planning, matchs)', () => {
    it('renvoie les noms courts des deux équipes et leurs logos', async () => {
      const repo = new MySqlMatchRepository(
        prisma(
          [
            {
              NUM_MATCH: 1,
              MATCH_CASE: 1,
              EQUIPE1: 'Courbevoie',
              EQUIPE2: 'Orléans',
              EQUIPE_ID1: 12,
              EQUIPE_ID2: 7,
              SCORE1: 1,
              SCORE2: 0,
              ETAT: 'x',
              DATEHEURE_SQL: '2026-05-23 09:00:00',
              SURFACAGE: 0,
            },
          ],
          [
            {
              ID: 12,
              EQUIPE: 'Courbevoie',
              IMAGE: null,
              CHALLENGE_SAMEDI_SQL: null,
            },
            {
              ID: 7,
              EQUIPE: 'Orléans',
              IMAGE: null,
              CHALLENGE_SAMEDI_SQL: null,
            },
          ],
          [],
        ),
        new MatchEnrichmentService(),
      );

      const match = (await repo.findAll()).find(
        (m) => m.teamA === 'Courbevoie',
      )!;

      expect(match.teamA).toBe('Courbevoie');
      expect(match.teamB).toBe('Orléans');
      expect(match.teamALogo).toBe(`${BASE}/courbevoie.png`);
      expect(match.teamBLogo).toBe(`${BASE}/orleans.png`);
      expect(JSON.stringify(match)).not.toContain('nomComplet');
    });
  });

  describe('MySqlChallengeJ1MomentumRepository (momentum challenge)', () => {
    it('renvoie le nom court et son logo', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-05-24T09:00:00Z'));
      const repo = new MySqlChallengeJ1MomentumRepository(
        prisma(
          [
            {
              ID: 12,
              EQUIPE: 'Courbevoie',
              CHALLENGE_SAMEDI_SQL: '2026-05-24 11:30:00',
            },
          ],
          [],
        ),
      );

      const [entree] = await repo.findJ1Momentum();

      expect(entree.teamName).toBe('Courbevoie');
      expect(entree.teamLogoUrl).toBe(`${BASE}/courbevoie.png`);
      expect(entree).not.toHaveProperty('nomComplet');
    });
  });

  // Le front (ChallengePage) recalcule un logo de secours pour les joueurs des finales.
  // Il doit partir de teamName, pas de teamId : en base réelle teamId est la clé
  // numérique de ta_equipes. Ces deux tests fixent ce contrat.
  describe.each([
    [
      'MySqlChallengeVitesseJ3Repository',
      (p: PrismaService) => new MySqlChallengeVitesseJ3Repository(p),
      {
        ID: 101,
        EQUIPE_ID: 12,
        NOM: 'Martin',
        PRENOM: 'Léo',
        QF: null,
        DF: null,
        F: null,
        V: null,
      },
    ],
    [
      'MySqlChallengeGardienJ3Repository',
      (p: PrismaService) => new MySqlChallengeGardienJ3Repository(p),
      {
        ID: 101,
        EQUIPE_ID: 12,
        NOM: 'Martin',
        PRENOM: 'Léo',
        GARDIEN_DF: 'DF1',
        GARDIEN_F: null,
        GARDIEN_V: null,
      },
    ],
  ])('%s (finales challenge)', (_nom, creer, joueur) => {
    it('teamId est la clé numérique de l’équipe, teamName son nom court', async () => {
      const repo = creer(prisma([joueur], [{ ID: 12, EQUIPE: 'Courbevoie' }]));

      const [player] = await repo.findAll();

      expect(player.teamId).toBe('12');
      expect(player.teamName).toBe('Courbevoie');
      expect(player).not.toHaveProperty('nomComplet');
    });

    it('sans équipe correspondante, teamName retombe sur la clé — jamais sur un nom complet', async () => {
      const repo = creer(prisma([joueur], []));

      const [player] = await repo.findAll();

      expect(player.teamName).toBe('12');
    });
  });
});
