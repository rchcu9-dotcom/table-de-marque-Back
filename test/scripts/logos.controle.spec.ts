import * as fs from 'fs';
import * as path from 'path';
import {
  comparerInstantanes,
  controlerLogos,
  extraireNomsSeed,
  lireNoms,
  versMarkdown,
  type FichierLogo,
  type Instantane,
} from '../../scripts/logos/controle-logos.lib';

// docs/specs/-nettoyage-des-fichiers-de-logo-contexte-la-gestion-des-fich.md — §1, §5
// Règle « un fichier est utilisé si son nom est le slug d'un nom d'équipe connu ».

const BACK = path.resolve(__dirname, '../..');

/** Fichier factice : l'empreinte vaut le nom, sauf si un contenu commun est précisé. */
function logo(fichier: string, contenu = fichier): FichierLogo {
  return { fichier, taille: contenu.length, sha256: `sha-${contenu}` };
}

describe('controlerLogos — noms et fichiers', () => {
  it('ne signale rien quand chaque nom a son fichier et chaque fichier son nom', () => {
    const rapport = controlerLogos(
      [{ source: 'liste', noms: ['Rennes', 'Tours'] }],
      [logo('rennes.png'), logo('tours.png')],
    );

    expect(rapport.manquants).toEqual([]);
    expect(rapport.orphelins).toEqual([]);
    expect(rapport.doublons).toEqual([]);
  });

  it('signale un nom sans fichier, avec son slug et sa source (CA3)', () => {
    const rapport = controlerLogos(
      [{ source: 'liste', noms: ['Rennes', 'Le Mans'] }],
      [logo('rennes.png')],
    );

    expect(rapport.manquants).toEqual([
      { nom: 'Le Mans', slug: 'le-mans', sources: ['liste'] },
    ]);
  });

  it('signale un fichier sans nom (CA4)', () => {
    const rapport = controlerLogos(
      [{ source: 'liste', noms: ['Rennes'] }],
      [logo('rennes.png'), logo('cergy.png')],
    );

    expect(rapport.orphelins).toEqual(['cergy.png']);
    expect(rapport.manquants).toEqual([]);
  });

  it('translittère les accents : « Orléans » sert orleans.png, orlans.png est orphelin', () => {
    const rapport = controlerLogos(
      [{ source: 'liste', noms: ['Orléans', 'Compiègne', 'Trois-Chêne'] }],
      [
        logo('orleans.png'),
        logo('orlans.png'),
        logo('compiegne.png'),
        logo('compigne.png'),
        logo('trois-chne.png'),
      ],
    );

    expect(rapport.orphelins).toEqual([
      'compigne.png',
      'orlans.png',
      'trois-chne.png',
    ]);
    expect(rapport.manquants.map((m) => m.slug)).toEqual(['trois-chene']);
  });

  it.each([
    ['Dammarie/Cergy', 'dammarie-cergy.png'],
    ['Le Havre', 'le-havre.png'],
    ['Evry-Viry', 'evry-viry.png'],
    ['Amical 1', 'amical-1.png'],
    ['Ligue IDF', 'ligue-idf.png'],
    ['St-Brieuc', 'st-brieuc.png'],
    ['  La Roche  ', 'la-roche.png'],
  ])('« %s » est servi par %s', (nom, fichier) => {
    const rapport = controlerLogos(
      [{ source: 'ta_equipes', noms: [nom] }],
      [logo(fichier)],
    );

    expect(rapport.manquants).toEqual([]);
    expect(rapport.orphelins).toEqual([]);
  });

  it("un fichier d'une autre extension est toujours orphelin, même si son nom est un slug connu", () => {
    const rapport = controlerLogos(
      [{ source: 'liste', noms: ['Orleans-Hexa', 'Rennes'] }],
      [logo('orleans-hexa.svg'), logo('rennes.jpg'), logo('rennes.png')],
    );

    expect(rapport.orphelins).toEqual(['orleans-hexa.svg', 'rennes.jpg']);
    expect(rapport.manquants.map((m) => m.slug)).toEqual(['orleans-hexa']);
  });

  it('compare les noms de fichier en respectant la casse', () => {
    const rapport = controlerLogos(
      [{ source: 'liste', noms: ['Rennes'] }],
      [logo('Rennes.png')],
    );

    expect(rapport.orphelins).toEqual(['Rennes.png']);
    expect(rapport.manquants.map((m) => m.slug)).toEqual(['rennes']);
  });

  it('ignore les noms vides ou sans caractère utile', () => {
    const rapport = controlerLogos(
      [{ source: 'liste', noms: ['', '   ', '---', '🏒'] }],
      [logo('rennes.png')],
    );

    expect(rapport.manquants).toEqual([]);
    expect(rapport.orphelins).toEqual(['rennes.png']);
  });

  it('regroupe un même slug venu de plusieurs sources, sans doublon de manquant', () => {
    const rapport = controlerLogos(
      [
        { source: 'liste', noms: ['Le Havre'] },
        { source: 'mocks', noms: ['Le-Havre'] },
        { source: 'seed-2026', noms: ['Le Havre', 'Le Havre'] },
      ],
      [],
    );

    expect(rapport.manquants).toEqual([
      {
        nom: 'Le Havre',
        slug: 'le-havre',
        sources: ['liste', 'mocks', 'seed-2026'],
      },
    ]);
  });

  it("garde un fichier dès qu'une seule source le justifie (règle §1 : liste, base ou jeux de données)", () => {
    const fichiers = [logo('meyrin.png'), logo('amical-1.png')];

    const listeSeule = controlerLogos(
      [{ source: 'liste', noms: [] }],
      fichiers,
    );
    const avecBaseEtSeed = controlerLogos(
      [
        { source: 'liste', noms: [] },
        { source: 'ta_equipes:rchcu11_tournoi_test', noms: ['Amical 1'] },
        { source: 'seed-2026', noms: ['Meyrin'] },
      ],
      fichiers,
    );

    expect(listeSeule.orphelins).toEqual(['amical-1.png', 'meyrin.png']);
    expect(avecBaseEtSeed.orphelins).toEqual([]);
  });

  it('trie manquants et orphelins', () => {
    const rapport = controlerLogos(
      [{ source: 'liste', noms: ['Tours', 'Angers'] }],
      [logo('zzz.png'), logo('aaa.png')],
    );

    expect(rapport.manquants.map((m) => m.slug)).toEqual(['angers', 'tours']);
    expect(rapport.orphelins).toEqual(['aaa.png', 'zzz.png']);
  });
});

describe('controlerLogos — doublons (CA5)', () => {
  it('regroupe les fichiers de même empreinte', () => {
    const rapport = controlerLogos(
      [{ source: 'liste', noms: [] }],
      [
        logo('amicale-1.png', 'A1'),
        logo('amical-1.png', 'A1'),
        logo('fillesdefrance.png', 'FDF'),
        logo('filledefrance.png', 'FDF'),
        logo('rennes.png'),
      ],
    );

    expect(rapport.doublons).toEqual([
      ['amical-1.png', 'amicale-1.png'],
      ['filledefrance.png', 'fillesdefrance.png'],
    ]);
  });

  it('accepte un groupe de trois fichiers identiques', () => {
    const rapport = controlerLogos(
      [{ source: 'liste', noms: [] }],
      [logo('c.png', 'X'), logo('a.png', 'X'), logo('b.png', 'X')],
    );

    expect(rapport.doublons).toEqual([['a.png', 'b.png', 'c.png']]);
  });

  it('ne signale pas deux images différentes pour une même équipe (orlans / orleans)', () => {
    const rapport = controlerLogos(
      [{ source: 'liste', noms: ['Orléans'] }],
      [logo('orlans.png'), logo('orleans.png')],
    );

    expect(rapport.doublons).toEqual([]);
  });
});

describe('controlerLogos — inventaire (CA2)', () => {
  const rapport = controlerLogos(
    [
      { source: 'liste', noms: ['Rennes'] },
      { source: 'seed-2026', noms: ['Rennes', 'Meyrin'] },
    ],
    [logo('rennes.png'), logo('meyrin.png'), logo('cergy.png'), logo('x.svg')],
  );

  it('contient une ligne par fichier, triée', () => {
    expect(rapport.inventaire.map((l) => l.fichier)).toEqual([
      'cergy.png',
      'meyrin.png',
      'rennes.png',
      'x.svg',
    ]);
  });

  it('justifie chaque fichier par ses noms et leurs sources', () => {
    const parFichier = Object.fromEntries(
      rapport.inventaire.map((l) => [l.fichier, l.justifications]),
    );

    expect(parFichier['rennes.png']).toEqual([
      { nom: 'Rennes', source: 'liste' },
      { nom: 'Rennes', source: 'seed-2026' },
    ]);
    expect(parFichier['meyrin.png']).toEqual([
      { nom: 'Meyrin', source: 'seed-2026' },
    ]);
    expect(parFichier['cergy.png']).toEqual([]);
    expect(parFichier['x.svg']).toEqual([]);
  });

  it('les orphelins sont exactement les lignes sans justification', () => {
    expect(rapport.orphelins).toEqual(
      rapport.inventaire
        .filter((l) => l.justifications.length === 0)
        .map((l) => l.fichier),
    );
  });

  it('versMarkdown produit un tableau à coller dans le suivi', () => {
    const lignes = versMarkdown(rapport).trimEnd().split('\n');

    expect(lignes[0]).toBe('| Fichier | Justification |');
    expect(lignes[1]).toMatch(/^\|-+\|-+\|$/);
    expect(lignes).toHaveLength(2 + 4);
    expect(lignes).toContain('| `cergy.png` | sans nom |');
    expect(lignes).toContain('| `meyrin.png` | « Meyrin » (seed-2026) |');
    expect(lignes).toContain(
      '| `rennes.png` | « Rennes » (liste), « Rennes » (seed-2026) |',
    );
  });

  it('versMarkdown échappe les barres verticales des noms', () => {
    const md = versMarkdown(
      controlerLogos([{ source: 'liste', noms: ['A|B'] }], [logo('a-b.png')]),
    );

    expect(md).toContain('« A\\|B »');
  });
});

describe('lireNoms', () => {
  it('lit un tableau de chaînes', () => {
    expect(lireNoms(['Rennes', 'Tours'])).toEqual(['Rennes', 'Tours']);
  });

  it('lit le format de correspondance { nom, nomComplet }', () => {
    expect(
      lireNoms([
        { nom: 'Courbevoie', nomComplet: 'Les Coqs de Courbevoie' },
        'Rennes',
      ]),
    ).toEqual(['Courbevoie', 'Rennes']);
  });

  it("lit le fichier d'exemple du dépôt", () => {
    const exemple: unknown = JSON.parse(
      fs.readFileSync(
        path.join(BACK, 'scripts/logos/noms.exemple.json'),
        'utf8',
      ),
    );

    expect(lireNoms(exemple)).toEqual(['Exemple', 'Autre Exemple']);
  });

  it.each([[{ nom: 'Rennes' }], ['Rennes'], [null], [42]])(
    'refuse un contenu qui n’est pas un tableau (%j)',
    (contenu) => {
      expect(() => lireNoms(contenu)).toThrow(/tableau JSON/);
    },
  );

  it.each([
    [[42]],
    [[null]],
    [[{ nomComplet: 'Sans nom court' }]],
    [[{ nom: 3 }]],
  ])('refuse une ligne sans nom exploitable (%j)', (contenu) => {
    expect(() => lireNoms(contenu)).toThrow(/Ligne 1/);
  });
});

describe('extraireNomsSeed', () => {
  it('extrait les 16 équipes du seed 2026 réel', () => {
    const sql = fs.readFileSync(
      path.join(BACK, 'prisma/seed-tournoi-2026.sql'),
      'utf8',
    );

    const noms = extraireNomsSeed(sql);

    expect(noms).toHaveLength(16);
    expect(noms).toEqual(
      expect.arrayContaining([
        'Meyrin',
        'Le Havre',
        'Evry-Viry',
        'Les Volants',
      ]),
    );
    // La colonne IMAGE (legacy) ne doit pas être prise pour un nom.
    expect(noms.some((n) => n.endsWith('.png'))).toBe(false);
  });

  it('repère la colonne EQUIPE par son rang, où qu’elle soit', () => {
    const sql =
      "INSERT INTO `ta_equipes` (`IMAGE`, `ID`, `EQUIPE`) VALUES ('a.png', 1, 'Rennes'), ('b.png', 2, 'Tours');";

    expect(extraireNomsSeed(sql)).toEqual(['Rennes', 'Tours']);
  });

  it('gère virgules, parenthèses, apostrophes doublées et point-virgule dans les chaînes', () => {
    const sql = [
      'INSERT INTO ta_equipes (ID, EQUIPE, COACH_1) VALUES',
      "(1, 'Dammarie, Cergy', 'x'),",
      "(2, 'Club (B)', 'y;z'),",
      "(3, 'L''Hermine', NOW()),",
      "(4, NULL, 'sans nom');",
    ].join('\n');

    expect(extraireNomsSeed(sql)).toEqual([
      'Dammarie, Cergy',
      'Club (B)',
      "L'Hermine",
    ]);
  });

  it('ignore les autres tables et lit plusieurs INSERT', () => {
    const sql = [
      "INSERT INTO `ta_joueurs` (`ID`, `EQUIPE`) VALUES (1, 'Pas une équipe');",
      "INSERT INTO `ta_equipes` (`ID`, `EQUIPE`) VALUES (1, 'Rennes');",
      "INSERT INTO `ta_matchs` (`ID`, `EQUIPE1`) VALUES (1, 'Tours');",
      "INSERT INTO `ta_equipes` (`ID`, `EQUIPE`) VALUES (2, 'Angers');",
    ].join('\n');

    expect(extraireNomsSeed(sql)).toEqual(['Rennes', 'Angers']);
  });

  it('renvoie une liste vide sans INSERT ta_equipes ou sans colonne EQUIPE', () => {
    expect(extraireNomsSeed('TRUNCATE TABLE `ta_equipes`;')).toEqual([]);
    expect(
      extraireNomsSeed(
        "INSERT INTO `ta_equipes` (`ID`, `IMAGE`) VALUES (1, 'a.png');",
      ),
    ).toEqual([]);
  });
});

describe('comparerInstantanes', () => {
  const avant: Instantane = {
    fichiers: [
      logo('compiegne.png', 'CMP'),
      logo('compigne.png', 'CMP'),
      logo('trois-chne.png', 'TC'),
      logo('rennes.png', 'REN'),
    ],
    manquants: ['Trois-Chêne'],
  };

  it('ne signale rien entre deux états identiques', () => {
    expect(comparerInstantanes(avant, avant)).toEqual({
      logosPerdus: [],
      supprimes: [],
      renommes: [],
      ajoutes: [],
      modifies: [],
    });
  });

  it("classe « supprimé » le retrait d'un doublon dont la copie reste", () => {
    const apres: Instantane = {
      ...avant,
      fichiers: avant.fichiers.filter((f) => f.fichier !== 'compigne.png'),
    };

    const ecart = comparerInstantanes(avant, apres);

    expect(ecart.supprimes).toEqual(['compigne.png']);
    expect(ecart.renommes).toEqual([]);
    expect(ecart.ajoutes).toEqual([]);
  });

  it('reconnaît un renommage à son empreinte et ne le compte pas comme ajout (CA6, CA8)', () => {
    const apres: Instantane = {
      fichiers: [
        logo('compiegne.png', 'CMP'),
        logo('compigne.png', 'CMP'),
        logo('trois-chene.png', 'TC'),
        logo('rennes.png', 'REN'),
      ],
      manquants: [],
    };

    const ecart = comparerInstantanes(avant, apres);

    expect(ecart.renommes).toEqual([
      { de: 'trois-chne.png', vers: 'trois-chene.png' },
    ]);
    expect(ecart.supprimes).toEqual([]);
    expect(ecart.ajoutes).toEqual([]);
    expect(ecart.logosPerdus).toEqual([]);
  });

  it('signale un fichier ajouté (CA8)', () => {
    const apres: Instantane = {
      ...avant,
      fichiers: [...avant.fichiers, logo('nouveau.png', 'NEW')],
    };

    expect(comparerInstantanes(avant, apres).ajoutes).toEqual(['nouveau.png']);
  });

  it("n'apparie qu'une cible par fichier disparu : la seconde est un ajout", () => {
    const apres: Instantane = {
      fichiers: [
        logo('compiegne.png', 'CMP'),
        logo('compigne.png', 'CMP'),
        logo('rennes.png', 'REN'),
        logo('trois-chene.png', 'TC'),
        logo('trois-chenes.png', 'TC'),
      ],
      manquants: [],
    };

    const ecart = comparerInstantanes(avant, apres);

    expect(ecart.renommes).toHaveLength(1);
    expect(ecart.ajoutes).toHaveLength(1);
  });

  it('signale un contenu modifié sous le même nom (CA6)', () => {
    const apres: Instantane = {
      ...avant,
      fichiers: avant.fichiers.map((f) =>
        f.fichier === 'rennes.png' ? logo('rennes.png', 'AUTRE') : f,
      ),
    };

    const ecart = comparerInstantanes(avant, apres);

    expect(ecart.modifies).toEqual(['rennes.png']);
    expect(ecart.supprimes).toEqual([]);
    expect(ecart.ajoutes).toEqual([]);
  });

  it('signale un logo perdu, sans recompter ceux qui manquaient déjà (CA3)', () => {
    const apres: Instantane = {
      fichiers: avant.fichiers.filter((f) => f.fichier !== 'rennes.png'),
      manquants: ['Trois-Chêne', 'Rennes'],
    };

    const ecart = comparerInstantanes(avant, apres);

    expect(ecart.logosPerdus).toEqual(['Rennes']);
    expect(ecart.supprimes).toEqual(['rennes.png']);
  });
});

describe('Lot A — scénario complet sur les fichiers de la spec', () => {
  const noms = [
    {
      source: 'ta_equipes',
      noms: ['Amical 1', 'Amical 2', 'Ligue IDF', 'Compiegne', 'Orléans'],
    },
  ];
  const dossierAvant = [
    logo('amical-1.png', 'A1'),
    logo('amicale-1.png', 'A1'),
    logo('amical-2.png', 'A2'),
    logo('amicale-2.png', 'A2'),
    logo('compiegne.png', 'CMP'),
    logo('compigne.png', 'CMP'),
    logo('ligue-idf.png', 'IDF'),
    logo('fililedefrance.png', 'IDF'),
    logo('filledefrance.png', 'FDF'),
    logo('fillesdefrance.png', 'FDF'),
    logo('orleans.png'),
    logo('orlans.png'),
    logo('orleans-hexa.svg'),
  ];
  const LOT_A = [
    'amicale-1.png',
    'amicale-2.png',
    'compigne.png',
    'fililedefrance.png',
    'filledefrance.png',
    'fillesdefrance.png',
    'orlans.png',
    'orleans-hexa.svg',
  ];

  it('avant : les 8 fichiers du lot A sont exactement les orphelins, 5 paires identiques', () => {
    const rapport = controlerLogos(noms, dossierAvant);

    expect(rapport.orphelins).toEqual(LOT_A);
    expect(rapport.doublons).toHaveLength(5);
    expect(rapport.manquants).toEqual([]);
  });

  it('après : aucun orphelin, aucun doublon, aucun logo perdu', () => {
    const dossierApres = dossierAvant.filter((f) => !LOT_A.includes(f.fichier));
    const avant = controlerLogos(noms, dossierAvant);
    const apres = controlerLogos(noms, dossierApres);

    expect(apres.orphelins).toEqual([]);
    expect(apres.doublons).toEqual([]);
    expect(apres.manquants).toEqual([]);

    const ecart = comparerInstantanes(
      { fichiers: dossierAvant, manquants: avant.manquants.map((m) => m.nom) },
      { fichiers: dossierApres, manquants: apres.manquants.map((m) => m.nom) },
    );
    expect(ecart.supprimes).toEqual(LOT_A);
    expect(ecart.logosPerdus).toEqual([]);
    expect(ecart.ajoutes).toEqual([]);
    expect(ecart.modifies).toEqual([]);
  });

  it('précondition prod : une équipe encore nommée « Amicale 1 » fait conserver amicale-1.png', () => {
    const rapport = controlerLogos(
      [...noms, { source: 'prod', noms: ['Amicale 1'] }],
      dossierAvant,
    );

    expect(rapport.orphelins).not.toContain('amicale-1.png');
    expect(rapport.orphelins).toContain('amicale-2.png');
  });
});

describe('Le script ne modifie jamais le dossier des logos', () => {
  const lib = fs.readFileSync(
    path.join(BACK, 'scripts/logos/controle-logos.lib.ts'),
    'utf8',
  );
  const exe = fs.readFileSync(
    path.join(BACK, 'scripts/logos/controle-logos.ts'),
    'utf8',
  );

  it('la logique pure ne touche ni au disque, ni à la base, ni à git', () => {
    expect(lib).not.toMatch(/from 'fs'|from 'node:fs'|require\(/);
    expect(lib).not.toMatch(/child_process|@prisma\/client|guard/);
  });

  it("l'exécutable ne contient aucun appel de suppression ou de renommage", () => {
    expect(exe).not.toMatch(
      /\b(unlink|unlinkSync|rm|rmSync|rmdir|rmdirSync|rename|renameSync|copyFile|copyFileSync|appendFile|appendFileSync)\s*\(/,
    );
    expect(exe).not.toMatch(/child_process|execSync|spawn/);
  });

  it("l'exécutable n'écrit qu'un fichier, sous out/", () => {
    const ecritures = exe.match(/writeFile(Sync)?\s*\(/g) ?? [];
    expect(ecritures).toHaveLength(1);
    expect(exe).toMatch(
      /path\.join\(OUT_DIR, path\.basename\(args\.instantane\)\)/,
    );
  });

  it('la base passe par le garde-fou ADR-002, en lecture seule', () => {
    expect(exe).toMatch(/openGuardedClient/);
    expect(exe).not.toMatch(/new PrismaClient/);
    expect(exe).not.toMatch(/\$executeRaw/);
    expect(exe).not.toMatch(/\b(UPDATE|DELETE|INSERT|ALTER|DROP|TRUNCATE)\b/);
  });
});
