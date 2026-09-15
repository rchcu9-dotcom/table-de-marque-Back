import { Equipe } from '@/domain/equipe/entities/equipe.entity';
import { MatchLive } from '@/table-de-marque/domain/entities/match-live.entity';
import { MatchLiveEtat } from '@/table-de-marque/domain/enums/match-live-etat.enum';
import {
  PlacementCote,
  PlanningMatchSlot,
} from '../../domain/entities/planning-match-slot.entity';
import { PlanningPlaceholderResolverService } from './planning-placeholder-resolver.service';

type SlotOverrides = Partial<{
  id: number;
  editionId: number;
  numMatch: number;
  cote: PlacementCote;
  ref: string;
  libellePlaceholder: string;
  numMatchSource: number | null;
  pouleCode: string | null;
  rangPoule: number | null;
  resolu: boolean;
  equipeIdResolu: number | null;
  equipeNomResolu: string | null;
  resoluAt: Date | null;
  resoluManuellement: boolean;
}>;

function makeSlot(overrides: SlotOverrides = {}): PlanningMatchSlot {
  return new PlanningMatchSlot(
    overrides.id ?? 1,
    overrides.editionId ?? 1,
    overrides.numMatch ?? 10,
    overrides.cote ?? 1,
    overrides.ref ?? 'placeholder:poule-A-rang-1',
    overrides.libellePlaceholder ?? '1er Poule A',
    overrides.numMatchSource ?? null,
    overrides.pouleCode ?? 'A',
    overrides.rangPoule ?? 1,
    overrides.resolu ?? false,
    overrides.equipeIdResolu ?? null,
    overrides.equipeNomResolu ?? null,
    overrides.resoluAt ?? null,
    overrides.resoluManuellement ?? false,
  );
}

type EquipeOverrides = Partial<{
  id: string;
  name: string;
  joues: number;
  points: number;
  bp: number;
  bc: number;
  diff: number;
  rang: number;
}>;

// `rang` vient désormais de ClassementPouleEngine (pas recalculé par le
// service) : les fixtures doivent donc le fournir explicitement pour
// refléter les égalités voulues par chaque test (deux équipes ex æquo
// partagent le même `rang`, jamais départagées par point/diff/bp en dur).
function makeEquipe(overrides: EquipeOverrides = {}): Equipe {
  const nom = overrides.name ?? overrides.id ?? 'Equipe';
  return new Equipe(
    overrides.id ?? nom,
    nom,
    null,
    'A',
    'Poule A',
    overrides.rang ?? 1,
    overrides.joues ?? 2,
    1,
    0,
    0,
    overrides.points ?? 3,
    overrides.bp ?? 3,
    overrides.bc ?? 1,
    overrides.diff ?? 2,
  );
}

function makeMatchLive(
  overrides: Partial<{
    numMatch: number;
    etat: MatchLiveEtat;
    score1Cache: number;
    score2Cache: number;
  }> = {},
): MatchLive {
  return new MatchLive(
    overrides.numMatch ?? 5,
    overrides.etat ?? MatchLiveEtat.TERMINE,
    0,
    false,
    null,
    overrides.score1Cache ?? 3,
    overrides.score2Cache ?? 1,
    new Date('2026-09-06T00:00:00.000Z'),
    new Date('2026-09-06T00:00:00.000Z'),
  );
}

function makeService() {
  const slotRepo = {
    createMany: jest.fn(),
    findAllByEdition: jest.fn().mockResolvedValue([]),
    findNonResolusParPoule: jest.fn().mockResolvedValue([]),
    findByNumMatchSource: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
    marquerResolu: jest.fn(),
  };
  const matchWriter = {
    ecrireMatchs: jest.fn(),
    resoudreSlot: jest.fn().mockResolvedValue(undefined),
    trouverEquipesMatch: jest.fn(),
    trouverEquipeIdParNom: jest.fn(),
    trouverEquipeNomParId: jest.fn(),
  };
  const equipeRepo = {
    findClassementByPoule: jest.fn(),
    findClassementByTeamName: jest.fn(),
    findAllEquipes: jest.fn(),
    findEquipeById: jest.fn(),
  };
  const matchLiveRepo = {
    findByNumMatch: jest.fn(),
    upsert: jest.fn(),
    recomputeScore: jest.fn(),
  };
  const service = new PlanningPlaceholderResolverService(
    slotRepo as any,
    matchWriter as any,
    equipeRepo as any,
    matchLiveRepo as any,
  );
  return { service, slotRepo, matchWriter, equipeRepo, matchLiveRepo };
}

// Aide à construire une entrée de PlanningMatchSlot.marquerResolu simulant la
// persistance du côté déjà résolu, réutilisée par plusieurs mocks.
function makeResolvedSlot(base: PlanningMatchSlot, equipeId: number, equipeNom: string): PlanningMatchSlot {
  return makeSlot({
    id: base.id,
    editionId: base.editionId,
    numMatch: base.numMatch,
    cote: base.cote,
    ref: base.ref,
    numMatchSource: base.numMatchSource,
    pouleCode: base.pouleCode,
    rangPoule: base.rangPoule,
    resolu: true,
    equipeIdResolu: equipeId,
    equipeNomResolu: equipeNom,
    resoluAt: new Date('2026-09-06T00:00:00.000Z'),
  });
}

describe('PlanningPlaceholderResolverService', () => {
  describe('resoudreParConfrontation', () => {
    it("retourne [] sans lire MatchLive quand aucun slot ne dépend du match", async () => {
      const { service, slotRepo, matchLiveRepo } = makeService();
      slotRepo.findByNumMatchSource.mockResolvedValue([]);

      const result = await service.resoudreParConfrontation(5);

      expect(result).toEqual([]);
      expect(matchLiveRepo.findByNumMatch).not.toHaveBeenCalled();
    });

    it('retourne [] quand le match live est introuvable', async () => {
      const { service, slotRepo, matchLiveRepo } = makeService();
      const slot = makeSlot({ numMatchSource: 5, pouleCode: null, rangPoule: null });
      slotRepo.findByNumMatchSource.mockResolvedValue([slot]);
      matchLiveRepo.findByNumMatch.mockResolvedValue(null);

      expect(await service.resoudreParConfrontation(5)).toEqual([]);
    });

    it("retourne [] quand le match n'est pas encore TERMINE", async () => {
      const { service, slotRepo, matchLiveRepo } = makeService();
      slotRepo.findByNumMatchSource.mockResolvedValue([makeSlot({ numMatchSource: 5 })]);
      matchLiveRepo.findByNumMatch.mockResolvedValue(makeMatchLive({ etat: MatchLiveEtat.EN_COURS }));

      expect(await service.resoudreParConfrontation(5)).toEqual([]);
    });

    it("marque tous les slots dépendants comme ambigus en cas d'égalité de score, sans écrire", async () => {
      const { service, slotRepo, matchLiveRepo, matchWriter } = makeService();
      const slot = makeSlot({ numMatchSource: 5, pouleCode: null, rangPoule: null });
      slotRepo.findByNumMatchSource.mockResolvedValue([slot]);
      matchLiveRepo.findByNumMatch.mockResolvedValue(
        makeMatchLive({ score1Cache: 2, score2Cache: 2 }),
      );

      const result = await service.resoudreParConfrontation(5);

      expect(result).toEqual([
        { slot, ambigu: true, raison: expect.stringContaining('égalité') },
      ]);
      expect(matchWriter.resoudreSlot).not.toHaveBeenCalled();
      expect(slotRepo.marquerResolu).not.toHaveBeenCalled();
    });

    it('marque ambigu si les équipes du match source sont introuvables', async () => {
      const { service, slotRepo, matchLiveRepo, matchWriter } = makeService();
      const slot = makeSlot({ numMatchSource: 5 });
      slotRepo.findByNumMatchSource.mockResolvedValue([slot]);
      matchLiveRepo.findByNumMatch.mockResolvedValue(makeMatchLive());
      matchWriter.trouverEquipesMatch.mockResolvedValue(null);

      const result = await service.resoudreParConfrontation(5);

      expect(result).toEqual([
        { slot, ambigu: true, raison: expect.stringContaining('non identifiées') },
      ]);
    });

    it("marque ambigu si une des deux équipes n'a pas d'ID numérique", async () => {
      const { service, slotRepo, matchLiveRepo, matchWriter } = makeService();
      const slot = makeSlot({ numMatchSource: 5 });
      slotRepo.findByNumMatchSource.mockResolvedValue([slot]);
      matchLiveRepo.findByNumMatch.mockResolvedValue(makeMatchLive());
      matchWriter.trouverEquipesMatch.mockResolvedValue({
        equipeId1: null,
        equipeId2: 20,
        equipe1Nom: 'Aigles',
        equipe2Nom: 'Loups',
      });

      const result = await service.resoudreParConfrontation(5);

      expect(result[0]).toMatchObject({ ambigu: true });
    });

    it('résout avec l\'équipe du côté 1 quand son score est le plus haut', async () => {
      const { service, slotRepo, matchLiveRepo, matchWriter } = makeService();
      const slot = makeSlot({ id: 7, numMatch: 20, cote: 2, numMatchSource: 5, pouleCode: null, rangPoule: null });
      slotRepo.findByNumMatchSource.mockResolvedValue([slot]);
      matchLiveRepo.findByNumMatch.mockResolvedValue(
        makeMatchLive({ score1Cache: 3, score2Cache: 1 }),
      );
      matchWriter.trouverEquipesMatch.mockResolvedValue({
        equipeId1: 10,
        equipeId2: 11,
        equipe1Nom: 'Aigles',
        equipe2Nom: 'Loups',
      });
      slotRepo.marquerResolu.mockResolvedValue(makeResolvedSlot(slot, 10, 'Aigles'));

      const result = await service.resoudreParConfrontation(5);

      expect(matchWriter.resoudreSlot).toHaveBeenCalledWith(20, 2, 10, 'Aigles');
      expect(slotRepo.marquerResolu).toHaveBeenCalledWith(7, 10, 'Aigles', false);
      expect(result[0]).toMatchObject({ ambigu: false, equipeId: 10, equipeNom: 'Aigles' });
    });

    it('résout avec l\'équipe du côté 2 quand son score est le plus haut', async () => {
      const { service, slotRepo, matchLiveRepo, matchWriter } = makeService();
      const slot = makeSlot({ numMatchSource: 5, pouleCode: null, rangPoule: null });
      slotRepo.findByNumMatchSource.mockResolvedValue([slot]);
      matchLiveRepo.findByNumMatch.mockResolvedValue(
        makeMatchLive({ score1Cache: 1, score2Cache: 4 }),
      );
      matchWriter.trouverEquipesMatch.mockResolvedValue({
        equipeId1: 10,
        equipeId2: 11,
        equipe1Nom: 'Aigles',
        equipe2Nom: 'Loups',
      });
      slotRepo.marquerResolu.mockResolvedValue(makeResolvedSlot(slot, 11, 'Loups'));

      const result = await service.resoudreParConfrontation(5);

      expect(result[0]).toMatchObject({ ambigu: false, equipeId: 11, equipeNom: 'Loups' });
    });

    it('résout tous les slots qui dépendent du même match source', async () => {
      const { service, slotRepo, matchLiveRepo, matchWriter } = makeService();
      const slotDemiA = makeSlot({ id: 1, numMatch: 20, cote: 1, numMatchSource: 5, pouleCode: null, rangPoule: null });
      const slotDemiB = makeSlot({ id: 2, numMatch: 21, cote: 2, numMatchSource: 5, pouleCode: null, rangPoule: null });
      slotRepo.findByNumMatchSource.mockResolvedValue([slotDemiA, slotDemiB]);
      matchLiveRepo.findByNumMatch.mockResolvedValue(makeMatchLive({ score1Cache: 5, score2Cache: 2 }));
      matchWriter.trouverEquipesMatch.mockResolvedValue({
        equipeId1: 10,
        equipeId2: 11,
        equipe1Nom: 'Aigles',
        equipe2Nom: 'Loups',
      });
      slotRepo.marquerResolu.mockImplementation((id) =>
        Promise.resolve(makeResolvedSlot(id === 1 ? slotDemiA : slotDemiB, 10, 'Aigles')),
      );

      const result = await service.resoudreParConfrontation(5);

      expect(result).toHaveLength(2);
      expect(matchWriter.resoudreSlot).toHaveBeenCalledWith(20, 1, 10, 'Aigles');
      expect(matchWriter.resoudreSlot).toHaveBeenCalledWith(21, 2, 10, 'Aigles');
    });

    it("ne réécrase jamais un slot déjà résolu (critère d'acceptation 3)", async () => {
      const { service, slotRepo, matchLiveRepo, matchWriter } = makeService();
      const slot = makeSlot({
        numMatchSource: 5,
        pouleCode: null,
        rangPoule: null,
        resolu: true,
        equipeIdResolu: 99,
        equipeNomResolu: 'Déjà résolu',
      });
      slotRepo.findByNumMatchSource.mockResolvedValue([slot]);
      matchLiveRepo.findByNumMatch.mockResolvedValue(
        makeMatchLive({ score1Cache: 1, score2Cache: 4 }),
      );
      matchWriter.trouverEquipesMatch.mockResolvedValue({
        equipeId1: 10,
        equipeId2: 11,
        equipe1Nom: 'Aigles',
        equipe2Nom: 'Loups',
      });

      const result = await service.resoudreParConfrontation(5);

      expect(matchWriter.resoudreSlot).not.toHaveBeenCalled();
      expect(slotRepo.marquerResolu).not.toHaveBeenCalled();
      expect(result[0]).toMatchObject({ ambigu: false, equipeId: 99, equipeNom: 'Déjà résolu' });
    });
  });

  describe('resoudrePoule', () => {
    it("retourne [] sans lire le classement si aucun slot non résolu pour la poule", async () => {
      const { service, slotRepo, equipeRepo } = makeService();
      slotRepo.findNonResolusParPoule.mockResolvedValue([]);

      expect(await service.resoudrePoule(1, 'A')).toEqual([]);
      expect(equipeRepo.findClassementByPoule).not.toHaveBeenCalled();
    });

    it('retourne [] si la poule est introuvable', async () => {
      const { service, slotRepo, equipeRepo } = makeService();
      slotRepo.findNonResolusParPoule.mockResolvedValue([makeSlot()]);
      equipeRepo.findClassementByPoule.mockResolvedValue(null);

      expect(await service.resoudrePoule(1, 'A')).toEqual([]);
    });

    it("retourne [] si la poule n'est pas complète (round-robin pas terminé)", async () => {
      const { service, slotRepo, equipeRepo, matchWriter } = makeService();
      slotRepo.findNonResolusParPoule.mockResolvedValue([makeSlot()]);
      equipeRepo.findClassementByPoule.mockResolvedValue({
        pouleCode: 'A',
        pouleName: 'Poule A',
        equipes: [
          makeEquipe({ id: 'Aigles', joues: 2, rang: 1 }),
          makeEquipe({ id: 'Loups', joues: 1, rang: 2 }), // n'a pas encore joué tous ses matchs
          makeEquipe({ id: 'Ours', joues: 2, rang: 3 }),
        ],
      });

      expect(await service.resoudrePoule(1, 'A')).toEqual([]);
      expect(matchWriter.trouverEquipeIdParNom).not.toHaveBeenCalled();
    });

    it('résout le slot du rang cible quand la poule est complète et sans égalité', async () => {
      const { service, slotRepo, equipeRepo, matchWriter } = makeService();
      const slot = makeSlot({ rangPoule: 1, pouleCode: 'A' });
      slotRepo.findNonResolusParPoule.mockResolvedValue([slot]);
      equipeRepo.findClassementByPoule.mockResolvedValue({
        pouleCode: 'A',
        pouleName: 'Poule A',
        equipes: [
          makeEquipe({ id: 'Aigles', points: 9, diff: 5, bp: 10, rang: 1 }),
          makeEquipe({ id: 'Loups', points: 6, diff: 1, bp: 6, rang: 2 }),
          makeEquipe({ id: 'Ours', points: 0, diff: -6, bp: 2, rang: 3 }),
        ],
      });
      matchWriter.trouverEquipeIdParNom.mockResolvedValue(42);
      slotRepo.marquerResolu.mockResolvedValue(makeResolvedSlot(slot, 42, 'Aigles'));

      const result = await service.resoudrePoule(1, 'A');

      expect(matchWriter.trouverEquipeIdParNom).toHaveBeenCalledWith('Aigles');
      expect(matchWriter.resoudreSlot).toHaveBeenCalledWith(slot.numMatch, slot.cote, 42, 'Aigles');
      expect(result[0]).toMatchObject({ ambigu: false, equipeId: 42, equipeNom: 'Aigles' });
    });

    it('marque ambigu quand le rang cible dépasse le nombre d\'équipes de la poule', async () => {
      const { service, slotRepo, equipeRepo } = makeService();
      const slot = makeSlot({ rangPoule: 5, pouleCode: 'A' });
      slotRepo.findNonResolusParPoule.mockResolvedValue([slot]);
      equipeRepo.findClassementByPoule.mockResolvedValue({
        pouleCode: 'A',
        pouleName: 'Poule A',
        equipes: [
          makeEquipe({ id: 'Aigles', rang: 1 }),
          makeEquipe({ id: 'Loups', rang: 2 }),
        ],
      });

      const result = await service.resoudrePoule(1, 'A');

      expect(result[0]).toMatchObject({ ambigu: true });
      expect((result[0] as any).raison).toContain('Aucune équipe au rang');
    });

    it("marque ambigu en cas d'égalité avec l'équipe du rang au-dessus", async () => {
      const { service, slotRepo, equipeRepo, matchWriter } = makeService();
      const slot = makeSlot({ rangPoule: 2, pouleCode: 'A' });
      slotRepo.findNonResolusParPoule.mockResolvedValue([slot]);
      equipeRepo.findClassementByPoule.mockResolvedValue({
        pouleCode: 'A',
        pouleName: 'Poule A',
        equipes: [
          // Aigles et Loups ex æquo (même rang, calculé en amont par
          // ClassementPouleEngine) : la demande de rang 2 pointe
          // positionnellement sur Loups, dont le rang réel (1) ne correspond
          // pas au rang demandé (2) -> ambigu via le garde-fou rang-demandé.
          makeEquipe({ id: 'Aigles', points: 6, diff: 2, bp: 5, rang: 1 }),
          makeEquipe({ id: 'Loups', points: 6, diff: 2, bp: 5, rang: 1 }), // égalité totale avec Aigles
          makeEquipe({ id: 'Ours', points: 0, diff: -4, bp: 1, rang: 3 }),
        ],
      });

      const result = await service.resoudrePoule(1, 'A');

      expect(result[0]).toMatchObject({ ambigu: true });
      expect((result[0] as any).raison).toContain('non départagée');
      expect(matchWriter.trouverEquipeIdParNom).not.toHaveBeenCalled();
    });

    it("marque ambigu en cas d'égalité avec l'équipe du rang en-dessous", async () => {
      const { service, slotRepo, equipeRepo } = makeService();
      const slot = makeSlot({ rangPoule: 2, pouleCode: 'A' });
      slotRepo.findNonResolusParPoule.mockResolvedValue([slot]);
      equipeRepo.findClassementByPoule.mockResolvedValue({
        pouleCode: 'A',
        pouleName: 'Poule A',
        equipes: [
          makeEquipe({ id: 'Aigles', points: 9, diff: 5, bp: 10, rang: 1 }),
          makeEquipe({ id: 'Loups', points: 3, diff: 0, bp: 4, rang: 2 }),
          makeEquipe({ id: 'Ours', points: 3, diff: 0, bp: 4, rang: 2 }), // égalité totale avec Loups
        ],
      });

      const result = await service.resoudrePoule(1, 'A');

      expect(result[0]).toMatchObject({ ambigu: true });
    });

    it("marque ambigu quand le rang demandé n'est pas un rang réel (rang \"sauté\" par une égalité au-dessus, garde-fou rang-demandé vs position)", async () => {
      // Classement réel : 1, 1, 3, 4 (Aigles et Loups ex æquo au rang 1, donc
      // le rang 2 n'existe pour aucune équipe). Demander le rang 2 pointe
      // positionnellement sur Loups (index 1), dont le rang réel est 1, pas 2 :
      // ambigu, sans quoi le service résoudrait silencieusement le mauvais
      // rang (cf. §Arch/§Dev de docs/specs/chantier-suivant-implementer-le-
      // classement-live-doit-etre-ca.track.md).
      const { service, slotRepo, equipeRepo, matchWriter } = makeService();
      const slot = makeSlot({ rangPoule: 2, pouleCode: 'A' });
      slotRepo.findNonResolusParPoule.mockResolvedValue([slot]);
      equipeRepo.findClassementByPoule.mockResolvedValue({
        pouleCode: 'A',
        pouleName: 'Poule A',
        equipes: [
          makeEquipe({ id: 'Aigles', points: 6, diff: 2, bp: 5, rang: 1, joues: 3 }),
          makeEquipe({ id: 'Loups', points: 6, diff: 2, bp: 5, rang: 1, joues: 3 }), // égalité totale avec Aigles
          makeEquipe({ id: 'Ours', points: 3, diff: 0, bp: 3, rang: 3, joues: 3 }),
          makeEquipe({ id: 'Renards', points: 0, diff: -2, bp: 2, rang: 4, joues: 3 }),
        ],
      });

      const result = await service.resoudrePoule(1, 'A');

      expect(result[0]).toMatchObject({ ambigu: true });
      expect((result[0] as any).raison).toContain('non départagée');
      expect(matchWriter.trouverEquipeIdParNom).not.toHaveBeenCalled();
    });

    it('résout correctement le rang demandé après une égalité qui précède (rang 4 réel, poule 1,1,3,4)', async () => {
      // Même classement que le test précédent, mais on demande cette fois le
      // rang 4 (Renards), qui EST un rang réel malgré l'égalité au rang 1 :
      // doit se résoudre normalement, sans faux positif du garde-fou.
      const { service, slotRepo, equipeRepo, matchWriter } = makeService();
      const slot = makeSlot({ rangPoule: 4, pouleCode: 'A' });
      slotRepo.findNonResolusParPoule.mockResolvedValue([slot]);
      equipeRepo.findClassementByPoule.mockResolvedValue({
        pouleCode: 'A',
        pouleName: 'Poule A',
        equipes: [
          makeEquipe({ id: 'Aigles', points: 6, diff: 2, bp: 5, rang: 1, joues: 3 }),
          makeEquipe({ id: 'Loups', points: 6, diff: 2, bp: 5, rang: 1, joues: 3 }),
          makeEquipe({ id: 'Ours', points: 3, diff: 0, bp: 3, rang: 3, joues: 3 }),
          makeEquipe({ id: 'Renards', points: 0, diff: -2, bp: 2, rang: 4, joues: 3 }),
        ],
      });
      matchWriter.trouverEquipeIdParNom.mockResolvedValue(77);
      slotRepo.marquerResolu.mockResolvedValue(
        makeResolvedSlot(slot, 77, 'Renards'),
      );

      const result = await service.resoudrePoule(1, 'A');

      expect(matchWriter.trouverEquipeIdParNom).toHaveBeenCalledWith('Renards');
      expect(result[0]).toMatchObject({ ambigu: false, equipeId: 77, equipeNom: 'Renards' });
    });

    it("marque ambigu si l'équipe résolue est introuvable dans TA_EQUIPES", async () => {
      const { service, slotRepo, equipeRepo, matchWriter } = makeService();
      const slot = makeSlot({ rangPoule: 1, pouleCode: 'A' });
      slotRepo.findNonResolusParPoule.mockResolvedValue([slot]);
      equipeRepo.findClassementByPoule.mockResolvedValue({
        pouleCode: 'A',
        pouleName: 'Poule A',
        equipes: [
          makeEquipe({ id: 'Aigles', points: 9, diff: 5, bp: 10, rang: 1 }),
          makeEquipe({ id: 'Loups', points: 3, diff: -1, bp: 3, rang: 2 }),
        ],
      });
      matchWriter.trouverEquipeIdParNom.mockResolvedValue(null);

      const result = await service.resoudrePoule(1, 'A');

      expect(result[0]).toMatchObject({ ambigu: true });
      expect((result[0] as any).raison).toContain('introuvable dans TA_EQUIPES');
    });
  });

  describe('revaliderToutesLesPoules', () => {
    it('ignore les slots de bracket (sans pouleCode) et les slots déjà résolus', async () => {
      const { service, slotRepo } = makeService();
      slotRepo.findAllByEdition.mockResolvedValue([
        makeSlot({ id: 1, pouleCode: 'A', resolu: false }),
        makeSlot({ id: 2, pouleCode: null, resolu: false }), // bracket
        makeSlot({ id: 3, pouleCode: 'A', resolu: true }),
      ]);
      const resoudrePouleSpy = jest
        .spyOn(service, 'resoudrePoule')
        .mockResolvedValue([]);

      await service.revaliderToutesLesPoules(1);

      expect(resoudrePouleSpy).toHaveBeenCalledTimes(1);
      expect(resoudrePouleSpy).toHaveBeenCalledWith(1, 'A');
    });

    it('revérifie chaque poule distincte et agrège les résultats', async () => {
      const { service, slotRepo } = makeService();
      slotRepo.findAllByEdition.mockResolvedValue([
        makeSlot({ id: 1, pouleCode: 'A', resolu: false }),
        makeSlot({ id: 2, pouleCode: 'B', resolu: false }),
      ]);
      const resultA = [{ slot: makeSlot({ id: 1 }), ambigu: false as const, equipeId: 1, equipeNom: 'A1' }];
      const resultB = [{ slot: makeSlot({ id: 2 }), ambigu: false as const, equipeId: 2, equipeNom: 'B1' }];
      jest
        .spyOn(service, 'resoudrePoule')
        .mockImplementation(async (_editionId, pouleCode) =>
          pouleCode === 'A' ? resultA : resultB,
        );

      const result = await service.revaliderToutesLesPoules(1);

      expect(result).toEqual([...resultA, ...resultB]);
    });

    it('ne revérifie aucune poule si tous les slots sont déjà résolus', async () => {
      const { service, slotRepo } = makeService();
      slotRepo.findAllByEdition.mockResolvedValue([
        makeSlot({ id: 1, pouleCode: 'A', resolu: true }),
      ]);
      const resoudrePouleSpy = jest.spyOn(service, 'resoudrePoule');

      expect(await service.revaliderToutesLesPoules(1)).toEqual([]);
      expect(resoudrePouleSpy).not.toHaveBeenCalled();
    });
  });
});
