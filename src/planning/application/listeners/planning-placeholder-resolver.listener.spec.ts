import { Subject } from 'rxjs';
import { PlanningPlaceholderResolverListener } from './planning-placeholder-resolver.listener';

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function makeListener() {
  const events$ = new Subject<any>();
  const matchStream = { observe: jest.fn().mockReturnValue(events$.asObservable()) };
  const resolver = {
    resoudreParConfrontation: jest.fn().mockResolvedValue([]),
    resoudrePoule: jest.fn().mockResolvedValue([]),
    revaliderToutesLesPoules: jest.fn().mockResolvedValue([]),
  };
  const editionResolver = {
    getEditionActive: jest.fn().mockResolvedValue({ id: 1 }),
  };
  const matchWriter = {
    ecrireMatchs: jest.fn(),
    resoudreSlot: jest.fn(),
    trouverEquipesMatch: jest
      .fn()
      .mockResolvedValue({ equipeId1: 10, equipeId2: 11, equipe1Nom: 'Aigles', equipe2Nom: 'Loups' }),
    trouverEquipeIdParNom: jest.fn(),
    trouverEquipeNomParId: jest.fn(),
  };
  const equipeRepo = {
    findClassementByPoule: jest.fn(),
    findClassementByTeamName: jest.fn(),
    findAllEquipes: jest.fn(),
    findEquipeById: jest.fn(),
  };

  const listener = new PlanningPlaceholderResolverListener(
    matchStream as any,
    resolver as any,
    editionResolver as any,
    matchWriter as any,
    equipeRepo as any,
  );

  return { listener, events$, matchStream, resolver, editionResolver, matchWriter, equipeRepo };
}

describe('PlanningPlaceholderResolverListener', () => {
  it('souscrit au flux MatchStreamService au démarrage du module', () => {
    const { listener, matchStream } = makeListener();

    listener.onModuleInit();

    expect(matchStream.observe).toHaveBeenCalledTimes(1);
  });

  it("ignore les événements qui ne sont pas de type match-live", async () => {
    const { listener, events$, resolver } = makeListener();
    listener.onModuleInit();

    events$.next({ type: 'matches', diff: {}, matches: [], timestamp: Date.now() });
    await flushPromises();

    expect(resolver.resoudreParConfrontation).not.toHaveBeenCalled();
  });

  it("ignore les événements match-live dont l'état n'est pas TERMINE", async () => {
    const { listener, events$, resolver } = makeListener();
    listener.onModuleInit();

    events$.next({ type: 'match-live', numMatch: 5, etat: 'EN_COURS', score1: 0, score2: 0, timestamp: Date.now() });
    await flushPromises();

    expect(resolver.resoudreParConfrontation).not.toHaveBeenCalled();
  });

  it('déclenche resoudreParConfrontation quand un match passe TERMINE', async () => {
    const { listener, events$, resolver } = makeListener();
    listener.onModuleInit();

    events$.next({ type: 'match-live', numMatch: 5, etat: 'TERMINE', score1: 3, score2: 1, timestamp: Date.now() });
    await flushPromises();

    expect(resolver.resoudreParConfrontation).toHaveBeenCalledWith(5);
  });

  it("revérifie une seule fois la poule si les deux équipes du match terminé appartiennent à la même poule", async () => {
    const { listener, events$, resolver, equipeRepo } = makeListener();
    equipeRepo.findClassementByTeamName.mockResolvedValue({ pouleCode: 'A', pouleName: 'Poule A', equipes: [] });
    listener.onModuleInit();

    events$.next({ type: 'match-live', numMatch: 5, etat: 'TERMINE', score1: 3, score2: 1, timestamp: Date.now() });
    await flushPromises();

    expect(resolver.resoudrePoule).toHaveBeenCalledTimes(1);
    expect(resolver.resoudrePoule).toHaveBeenCalledWith(1, 'A');
  });

  it('revérifie les deux poules séparément quand les deux équipes appartiennent à des poules différentes', async () => {
    const { listener, events$, resolver, equipeRepo } = makeListener();
    equipeRepo.findClassementByTeamName.mockImplementation((nom: string) =>
      Promise.resolve(
        nom === 'Aigles'
          ? { pouleCode: 'A', pouleName: 'Poule A', equipes: [] }
          : { pouleCode: 'B', pouleName: 'Poule B', equipes: [] },
      ),
    );
    listener.onModuleInit();

    events$.next({ type: 'match-live', numMatch: 5, etat: 'TERMINE', score1: 3, score2: 1, timestamp: Date.now() });
    await flushPromises();

    expect(resolver.resoudrePoule).toHaveBeenCalledWith(1, 'A');
    expect(resolver.resoudrePoule).toHaveBeenCalledWith(1, 'B');
    expect(resolver.resoudrePoule).toHaveBeenCalledTimes(2);
  });

  it("ne revérifie aucune poule si les équipes du match terminé sont introuvables (trouverEquipesMatch null)", async () => {
    const { listener, events$, resolver, matchWriter } = makeListener();
    matchWriter.trouverEquipesMatch.mockResolvedValue(null);
    listener.onModuleInit();

    events$.next({ type: 'match-live', numMatch: 5, etat: 'TERMINE', score1: 3, score2: 1, timestamp: Date.now() });
    await flushPromises();

    expect(resolver.resoudrePoule).not.toHaveBeenCalled();
  });

  it("n'interrompt pas l'abonnement si le traitement d'un événement échoue", async () => {
    const { listener, events$, resolver } = makeListener();
    resolver.resoudreParConfrontation
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue([]);
    listener.onModuleInit();

    events$.next({ type: 'match-live', numMatch: 5, etat: 'TERMINE', score1: 3, score2: 1, timestamp: Date.now() });
    await flushPromises();
    events$.next({ type: 'match-live', numMatch: 6, etat: 'TERMINE', score1: 2, score2: 0, timestamp: Date.now() });
    await flushPromises();

    expect(resolver.resoudreParConfrontation).toHaveBeenCalledWith(5);
    expect(resolver.resoudreParConfrontation).toHaveBeenCalledWith(6);
  });
});
