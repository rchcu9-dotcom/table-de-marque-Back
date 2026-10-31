import * as fs from 'fs';
import * as path from 'path';
import { MOCK_TEAMS } from '../../src/hooks/mock-teams.data';
import { resoudreLogoEquipe } from '../../src/inscription/domain/equipe-referentiel-logo';
import {
  controlerLogos,
  extraireNomsSeed,
  type FichierLogo,
  type SourceNoms,
} from '../../scripts/logos/controle-logos.lib';

// docs/specs/-nettoyage-des-fichiers-de-logo-contexte-la-gestion-des-fich.md — CA2, CA4, CA7
// Inventaire définitif du suivi (Dev · 2026-10-30), rejoué avec le vrai calcul de slug.
// Le dossier réel appartient au dépôt front, absent de la CI du back : ce test porte sur
// l'inventaire écrit ici ; `front/tests/unit/logos-assets.test.ts` lie cette même liste
// au dossier. Les deux listes sont à modifier ensemble.

const BACK = path.resolve(__dirname, '../..');

/** insc_equipes_referentiel de prod, dump du 2026-10-19 : la « liste » de la spec. */
const REFERENTIEL_PROD: { nom: string; logoUrl: string }[] = [
  { nom: 'Rennes', logoUrl: '/assets/logos/rennes.png' },
  { nom: 'Dammarie/Cergy', logoUrl: '/assets/logos/dammarie-cergy.png' },
  { nom: 'St Brieuc', logoUrl: '/assets/logos/st-brieuc.png' },
  { nom: 'Anglet', logoUrl: '/assets/logos/anglet.png' },
  { nom: 'Le Havre', logoUrl: '/assets/logos/le-havre.png' },
  { nom: 'Angers', logoUrl: '/assets/logos/angers.png' },
  { nom: 'Rouen', logoUrl: '/assets/logos/rouen.png' },
  { nom: 'Brest', logoUrl: '/assets/logos/brest.png' },
  { nom: 'Nantes', logoUrl: '/assets/logos/nantes.png' },
  { nom: 'Meudon', logoUrl: '/assets/logos/meudon.png' },
  { nom: 'Tours', logoUrl: '/assets/logos/tours.png' },
  { nom: 'Poitiers', logoUrl: '/assets/logos/poitiers.png' },
  { nom: 'Gap', logoUrl: '/assets/logos/gap.png' },
  { nom: 'Dunkerque', logoUrl: '/assets/logos/dunkerque.png' },
  { nom: 'Caen', logoUrl: '/assets/logos/caen.png' },
  { nom: 'Les Volants', logoUrl: '/assets/logos/les-volants.png' },
  { nom: 'Neuilly', logoUrl: '/assets/logos/neuilly.png' },
  { nom: 'La Roche', logoUrl: '/assets/logos/la-roche.png' },
  { nom: 'Bordeaux', logoUrl: '/assets/logos/bordeaux.png' },
  { nom: 'Le Mans', logoUrl: '/assets/logos/le-mans.png' },
  { nom: 'Boulogne', logoUrl: '/assets/logos/boulogne.png' },
  { nom: 'Cergy', logoUrl: '/assets/logos/cergy.png' },
  { nom: 'Champigny', logoUrl: '/assets/logos/champigny.png' },
  { nom: 'Compiègne', logoUrl: '/assets/logos/compiegne.png' },
  { nom: 'Toulouse', logoUrl: '/assets/logos/toulouse.png' },
  { nom: 'Courbevoie', logoUrl: '/assets/logos/courbevoie.png' },
  { nom: 'Trois-Chêne', logoUrl: '/assets/logos/trois-chene.png' },
  { nom: 'Cholet', logoUrl: '/assets/logos/cholet.png' },
  { nom: 'Orléans', logoUrl: '/assets/logos/orleans.png' },
  { nom: 'Franconville', logoUrl: '/assets/logos/franconville.png' },
  { nom: 'Valenciennes', logoUrl: '/assets/logos/valenciennes.png' },
  { nom: 'Amiens', logoUrl: '/assets/logos/amiens.png' },
  {
    nom: 'Kretzers des Deurne Phantoms',
    logoUrl: '/assets/logos/kretzers-des-deurne-phantoms.png',
  },
  { nom: 'Ligue IDF', logoUrl: '/assets/logos/ligue-idf.png' },
  { nom: 'Meyrin', logoUrl: '/assets/logos/meyrin.png' },
];

/** ta_equipes de prod, dumps des 18 et 19/10/2026. */
const TA_EQUIPES_PROD = [
  'Courbevoie',
  'Orléans',
  'Champigny',
  'Dammarie/Cergy',
  'Meudon',
  'Neuilly',
  'Ligue IDF',
  'Amical 1',
  'Cholet',
  'Rennes',
  'Le Havre',
  'Amical 2',
  'Tours',
  'Les Volants',
  'La Roche',
  'Rouen',
];

/** Les 39 fichiers du dossier après les lots A1, A2 et B. */
const INVENTAIRE = [
  'amical-1',
  'amical-2',
  'amiens',
  'angers',
  'anglet',
  'bordeaux',
  'boulogne',
  'brest',
  'caen',
  'cergy',
  'champigny',
  'cholet',
  'compiegne',
  'courbevoie',
  'dammarie',
  'dammarie-cergy',
  'dunkerque',
  'evry-viry',
  'franconville',
  'gap',
  'kretzers-des-deurne-phantoms',
  'la-roche',
  'le-havre',
  'le-mans',
  'les-volants',
  'ligue-idf',
  'meudon',
  'meyrin',
  'nantes',
  'neuilly',
  'orleans',
  'poitiers',
  'rennes',
  'rouen',
  'st-brieuc',
  'toulouse',
  'tours',
  'trois-chene',
  'valenciennes',
].map((slug) => `${slug}.png`);

const SUPPRIMES = [
  'compigne.png',
  'orlans.png',
  'orleans-hexa.svg',
  'amicale-1.png',
  'amicale-2.png',
  'fililedefrance.png',
  'filledefrance.png',
  'fillesdefrance.png',
  'larochesuryon.png',
];

function logos(fichiers: readonly string[]): FichierLogo[] {
  return fichiers.map((fichier) => ({
    fichier,
    taille: 1,
    sha256: `sha-${fichier}`,
  }));
}

function sources(): SourceNoms[] {
  const seed = fs.readFileSync(
    path.join(BACK, 'prisma/seed-tournoi-2026.sql'),
    'utf8',
  );
  return [
    { source: 'liste', noms: REFERENTIEL_PROD.map((l) => l.nom) },
    { source: 'prod', noms: TA_EQUIPES_PROD },
    { source: 'seed-2026', noms: extraireNomsSeed(seed) },
    { source: 'mocks', noms: MOCK_TEAMS.map((t) => t.id) },
  ];
}

describe('Inventaire définitif des logos', () => {
  it('compte 39 fichiers et 35 lignes de référentiel', () => {
    expect(new Set(INVENTAIRE).size).toBe(39);
    expect(new Set(REFERENTIEL_PROD.map((l) => l.nom)).size).toBe(35);
  });

  it('chaque nom des quatre sources a son fichier (CA3)', () => {
    const rapport = controlerLogos(sources(), logos(INVENTAIRE));

    expect(rapport.manquants).toEqual([]);
  });

  it('chaque fichier a au moins un nom (CA4)', () => {
    const rapport = controlerLogos(sources(), logos(INVENTAIRE));

    expect(rapport.orphelins).toEqual([]);
  });

  it('chaque fichier supprimé serait orphelin s’il revenait : aucun nom ne le justifie', () => {
    const rapport = controlerLogos(
      sources(),
      logos([...INVENTAIRE, ...SUPPRIMES]),
    );

    expect(rapport.orphelins).toEqual([...SUPPRIMES].sort());
  });

  it.each([
    ['cergy.png', 'Cergy'],
    ['trois-chene.png', 'Trois-Chêne'],
    ['kretzers-des-deurne-phantoms.png', 'Kretzers des Deurne Phantoms'],
    ['compiegne.png', 'Compiègne'],
    ['orleans.png', 'Orléans'],
    ['st-brieuc.png', 'St Brieuc'],
  ])('%s est justifié par la liste (« %s »)', (fichier, nom) => {
    const { inventaire } = controlerLogos(sources(), logos(INVENTAIRE));
    const ligne = inventaire.find((l) => l.fichier === fichier);

    expect(ligne?.justifications).toContainEqual({ nom, source: 'liste' });
  });

  it.each([
    ['amical-1.png', 'Amical 1'],
    ['amical-2.png', 'Amical 2'],
  ])('%s reste justifié hors liste, par ta_equipes de prod', (fichier, nom) => {
    const { inventaire } = controlerLogos(sources(), logos(INVENTAIRE));
    const ligne = inventaire.find((l) => l.fichier === fichier);

    expect(ligne?.justifications).toContainEqual({ nom, source: 'prod' });
    expect(ligne?.justifications.map((j) => j.source)).not.toContain('liste');
  });

  it.each([['dammarie.png'], ['evry-viry.png']])(
    '%s n’est justifié que par le seed et les mocks',
    (fichier) => {
      const { inventaire } = controlerLogos(sources(), logos(INVENTAIRE));
      const ligne = inventaire.find((l) => l.fichier === fichier);

      expect(
        [...new Set(ligne?.justifications.map((j) => j.source))].sort(),
      ).toEqual(['mocks', 'seed-2026']);
    },
  );
});

describe('Liens du référentiel de prod (CA7)', () => {
  const baseOrigine = process.env.TEAM_LOGO_BASE_URL;

  beforeAll(() => {
    process.env.TEAM_LOGO_BASE_URL = 'https://cdn.test/assets/logos';
  });

  afterAll(() => {
    if (baseOrigine === undefined) delete process.env.TEAM_LOGO_BASE_URL;
    else process.env.TEAM_LOGO_BASE_URL = baseOrigine;
  });

  it.each(REFERENTIEL_PROD.map((l) => [l.nom, l.logoUrl]))(
    '« %s » : %s pointe vers un fichier conservé',
    (_nom, logoUrl) => {
      expect(INVENTAIRE).toContain(path.posix.basename(logoUrl));
    },
  );

  it.each(REFERENTIEL_PROD.map((l) => [l.nom, l.logoUrl]))(
    '« %s » : le logo affiché est le fichier enregistré dans logo_url',
    (nom, logoUrl) => {
      // Un chemin relatif n'est pas une adresse http(s) : le back le remplace par le PNG
      // déduit du nom court. Il doit donc retomber exactement sur le même fichier.
      const affiche = resoudreLogoEquipe(logoUrl, nom);

      expect(affiche).toBe(
        `https://cdn.test/assets/logos/${path.posix.basename(logoUrl)}`,
      );
    },
  );
});
