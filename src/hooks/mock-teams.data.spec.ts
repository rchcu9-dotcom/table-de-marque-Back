import { slugifyTeamName } from '@/infrastructure/persistence/mysql/mysql-utils';
import { InMemoryEquipeRepository } from '@/infrastructure/persistence/memory/in-memory-equipe.repository';
import { MockEquipeSeeder } from './mock-equipe.seeder';
import { MOCK_TEAMS } from './mock-teams.data';

// docs/specs/-impact-sur-les-pages-publiques-contexte-les-pages-publiques.md — §3, CA5
// En mode démonstration, les pages publiques affichent le nom court, comme en base réelle.

/** Anciens noms longs, qui ne doivent plus jamais servir de nom affiché. */
const NOMS_LONGS = [
  'Rennes Cormorans Hockey Club',
  'Les Caribous de Seine et Marne',
  'Les Korrigans de Saint Brieuc',
  'Les BullDocks du Havre',
  'Les Dragons de Rouen',
  'Les Comètes de Meudon',
];

describe('MOCK_TEAMS — données de démonstration', () => {
  it('décrit 16 équipes aux identifiants uniques', () => {
    expect(MOCK_TEAMS).toHaveLength(16);
    expect(new Set(MOCK_TEAMS.map((t) => t.id)).size).toBe(16);
  });

  it.each(MOCK_TEAMS.map((t) => [t.id, t] as const))(
    '%s : le nom affiché est le nom court, égal à l’identifiant',
    (_id, team) => {
      expect(team.name).toBe(team.id);
    },
  );

  it('affiche « Rennes », « Rouen », « Le-Havre » et plus leurs noms longs', () => {
    const noms = MOCK_TEAMS.map((t) => t.name);

    expect(noms).toEqual(
      expect.arrayContaining(['Rennes', 'Rouen', 'Le-Havre']),
    );
    for (const nomLong of NOMS_LONGS) expect(noms).not.toContain(nomLong);
  });

  it('aucun nom affiché ne ressemble à un nom de club (article, « Club », « de »)', () => {
    for (const { name } of MOCK_TEAMS) {
      expect(name).not.toMatch(/^Les?\s/);
      expect(name).not.toMatch(/\b(Club|de|du|des)\b/);
      expect(name.length).toBeLessThanOrEqual(12);
    }
  });

  it('garde le nom officiel dans nomComplet, sans le perdre', () => {
    const parId = new Map(MOCK_TEAMS.map((t) => [t.id, t.nomComplet]));

    expect(parId.get('Rennes')).toBe('Rennes Cormorans Hockey Club');
    expect(parId.get('Rouen')).toBe('Les Dragons de Rouen');
    expect(parId.get('Meudon')).toBe('Les Comètes de Meudon');
    for (const team of MOCK_TEAMS) {
      expect(typeof team.nomComplet).toBe('string');
      expect(team.nomComplet.trim()).not.toBe('');
    }
  });

  it('le slug du nom affiché est celui de l’identifiant : le logo ne dépend pas du nom complet', () => {
    for (const team of MOCK_TEAMS) {
      expect(slugifyTeamName(team.name)).toBe(slugifyTeamName(team.id));
    }
    expect(slugifyTeamName('Le-Havre')).toBe('le-havre');
    expect(slugifyTeamName('St-Brieuc')).toBe('st-brieuc');
  });

  it('ne change ni les identifiants ni leur ordre (clés des matchs et joueurs de démonstration)', () => {
    expect(MOCK_TEAMS.map((t) => t.id)).toEqual([
      'Rennes',
      'Dammarie',
      'St-Brieuc',
      'Anglet',
      'Evry-Viry',
      'Le-Havre',
      'Angers',
      'Rouen',
      'Brest',
      'Nantes',
      'Meudon',
      'Tours',
      'Poitiers',
      'Gap',
      'Dunkerque',
      'Caen',
    ]);
  });
});

describe('MockEquipeSeeder — équipes servies en mode démonstration', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  async function charger() {
    process.env.USE_MOCK_SCHEDULE = 'true';
    process.env.EQUIPE_REPOSITORY_DRIVER = 'memory';
    const repo = new InMemoryEquipeRepository();
    await new MockEquipeSeeder(repo).onModuleInit();
    return repo;
  }

  it('charge des équipes dont le nom est le nom court, égal à l’identifiant', async () => {
    const equipes = await (await charger()).findAllEquipes();

    expect(equipes.length).toBeGreaterThanOrEqual(16);
    for (const equipe of equipes) expect(equipe.name).toBe(equipe.id);
    expect(new Set(equipes.map((e) => e.name))).toEqual(
      new Set(MOCK_TEAMS.map((t) => t.id)),
    );
  });

  it('ne laisse fuir aucun nom complet dans les équipes ni dans les classements', async () => {
    const repo = await charger();
    const equipes = await repo.findAllEquipes();
    const pouleA = await repo.findClassementByPoule('A' as never);
    const contenu = JSON.stringify({ equipes, pouleA });

    for (const equipe of equipes)
      expect(equipe).not.toHaveProperty('nomComplet');
    for (const { nomComplet, id } of MOCK_TEAMS) {
      if (nomComplet !== id) expect(contenu).not.toContain(nomComplet);
    }
    expect(pouleA?.equipes.every((e) => e.name === e.id)).toBe(true);
  });

  it('ne charge rien hors mode démonstration', async () => {
    process.env.USE_MOCK_SCHEDULE = 'false';
    const repo = new InMemoryEquipeRepository();

    await new MockEquipeSeeder(repo).onModuleInit();

    expect(await repo.findAllEquipes()).toEqual([]);
  });
});
