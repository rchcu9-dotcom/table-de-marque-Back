import * as fs from 'fs';
import * as path from 'path';
import {
  construireReprise,
  lireCorrespondances,
  versSql,
  type EquipeExistante,
} from '../../scripts/equipes-referentiel/reprise-nom-complet.lib';

// docs/specs/-prise-en-compte-du-nom-court-pour-les-logos-contexte-actuel.md — §7, CA11

const REFERENTIEL: EquipeExistante[] = [
  { id: 1, nom: 'Courbevoie', nomComplet: null },
  { id: 2, nom: 'Rennes', nomComplet: 'Les Cormorans de Rennes' },
  { id: 3, nom: 'Meudon', nomComplet: 'Ancien nom' },
];

describe('construireReprise', () => {
  it('met à jour une équipe dont le nom complet est absent', () => {
    const plan = construireReprise(
      [{ nom: 'Courbevoie', nomComplet: 'Les Coqs de Courbevoie' }],
      REFERENTIEL,
    );

    expect(plan.majs).toEqual([
      { id: 1, nom: 'Courbevoie', nomComplet: 'Les Coqs de Courbevoie' },
    ]);
    expect(plan.dejaAJour).toEqual([]);
    expect(plan.absentes).toEqual([]);
    expect(plan.exclues).toEqual([]);
  });

  it('remplace un nom complet différent de celui de la liste', () => {
    const plan = construireReprise(
      [{ nom: 'Meudon', nomComplet: 'Les Comètes de Meudon' }],
      REFERENTIEL,
    );

    expect(plan.majs).toEqual([
      { id: 3, nom: 'Meudon', nomComplet: 'Les Comètes de Meudon' },
    ]);
  });

  it('classe « déjà à jour » une équipe qui porte déjà le nom complet de la liste', () => {
    const plan = construireReprise(
      [{ nom: 'Rennes', nomComplet: 'Les Cormorans de Rennes' }],
      REFERENTIEL,
    );

    expect(plan.majs).toEqual([]);
    expect(plan.dejaAJour).toEqual(['Rennes']);
  });

  it("ne crée jamais une équipe absente du référentiel : elle est seulement signalée", () => {
    const plan = construireReprise(
      [{ nom: 'Strasbourg', nomComplet: 'Les Aigles de Strasbourg' }],
      REFERENTIEL,
    );

    expect(plan.majs).toEqual([]);
    expect(plan.absentes).toEqual(['Strasbourg']);
  });

  it('exclut les lignes sans nom court (« Trois-Chêne », « Ligue IDF Féminines »)', () => {
    const plan = construireReprise(
      [
        { nom: '', nomComplet: 'Trois-Chêne' },
        { nom: '   ', nomComplet: 'Ligue IDF Féminines' },
      ],
      [...REFERENTIEL, { id: 4, nom: 'Trois-Chêne', nomComplet: null }],
    );

    expect(plan.majs).toEqual([]);
    expect(plan.absentes).toEqual([]);
    expect(plan.exclues).toEqual(['Trois-Chêne', 'Ligue IDF Féminines']);
  });

  it('exclut une ligne sans nom complet, ou dont le nom complet égale le nom court', () => {
    const plan = construireReprise(
      [
        { nom: 'Courbevoie', nomComplet: '' },
        { nom: 'Rennes', nomComplet: 'RENNES' },
      ],
      REFERENTIEL,
    );

    expect(plan.majs).toEqual([]);
    expect(plan.exclues).toEqual(['Courbevoie', 'Rennes']);
  });

  it('apparie sur le nom court exact, espaces de bord ignorés, sans rapprochement approximatif', () => {
    const plan = construireReprise(
      [
        { nom: '  Courbevoie ', nomComplet: ' Les Coqs de Courbevoie ' },
        { nom: 'courbevoie', nomComplet: 'Variante de casse' },
        { nom: 'Les Coqs de Courbevoie', nomComplet: 'Nom long pris pour un nom court' },
      ],
      REFERENTIEL,
    );

    expect(plan.majs).toEqual([
      { id: 1, nom: 'Courbevoie', nomComplet: 'Les Coqs de Courbevoie' },
    ]);
    expect(plan.absentes).toEqual(['courbevoie', 'Les Coqs de Courbevoie']);
  });

  it('refuse un nom court présent deux fois dans la liste', () => {
    expect(() =>
      construireReprise(
        [
          { nom: 'Courbevoie', nomComplet: 'Les Coqs de Courbevoie' },
          { nom: 'Courbevoie', nomComplet: 'Autre libellé' },
        ],
        REFERENTIEL,
      ),
    ).toThrow(/Courbevoie.*plusieurs fois/);
  });

  it('refuse un nom complet de plus de 150 caractères', () => {
    expect(() =>
      construireReprise([{ nom: 'Courbevoie', nomComplet: 'a'.repeat(151) }], REFERENTIEL),
    ).toThrow(/151 caractères/);
  });

  it('accepte un nom complet de 150 caractères', () => {
    const plan = construireReprise(
      [{ nom: 'Courbevoie', nomComplet: 'a'.repeat(150) }],
      REFERENTIEL,
    );

    expect(plan.majs).toHaveLength(1);
  });

  it('est idempotent : rejouer la liste après application ne prévoit plus aucune écriture', () => {
    const liste = [
      { nom: 'Courbevoie', nomComplet: 'Les Coqs de Courbevoie' },
      { nom: 'Meudon', nomComplet: 'Les Comètes de Meudon' },
      { nom: 'Rennes', nomComplet: 'Les Cormorans de Rennes' },
    ];
    const premier = construireReprise(liste, REFERENTIEL);
    const apresApplication = REFERENTIEL.map((equipe) => {
      const maj = premier.majs.find((m) => m.id === equipe.id);
      return maj ? { ...equipe, nomComplet: maj.nomComplet } : equipe;
    });

    const second = construireReprise(liste, apresApplication);

    expect(premier.majs).toHaveLength(2);
    expect(second.majs).toEqual([]);
    expect(second.dejaAJour).toEqual(['Courbevoie', 'Meudon', 'Rennes']);
  });

  it('ne modifie ni la liste ni le référentiel reçus', () => {
    const liste = [{ nom: ' Courbevoie ', nomComplet: ' Les Coqs de Courbevoie ' }];
    const copieListe = JSON.parse(JSON.stringify(liste));
    const copieReferentiel = JSON.parse(JSON.stringify(REFERENTIEL));

    construireReprise(liste, REFERENTIEL);

    expect(liste).toEqual(copieListe);
    expect(REFERENTIEL).toEqual(copieReferentiel);
  });
});

describe('versSql', () => {
  it('génère un UPDATE par équipe, ciblé sur id ET nom, et rien d’autre', () => {
    const sql = versSql(
      construireReprise(
        [
          { nom: 'Courbevoie', nomComplet: 'Les Coqs de Courbevoie' },
          { nom: 'Strasbourg', nomComplet: 'Les Aigles de Strasbourg' },
        ],
        REFERENTIEL,
      ),
    );
    const instructions = sql.split('\n').filter((l) => l && !l.startsWith('--'));

    expect(instructions).toEqual([
      "UPDATE `insc_equipes_referentiel` SET `nom_complet` = 'Les Coqs de Courbevoie' WHERE `id` = 1 AND `nom` = 'Courbevoie';",
    ]);
    expect(sql).not.toMatch(/INSERT|DELETE|SET `nom` =/i);
  });

  it('échappe les apostrophes et les antislashs', () => {
    const sql = versSql({
      majs: [{ id: 7, nom: "Val d'Oise", nomComplet: "Les Jets de l'Oise \\ Nord" }],
      dejaAJour: [],
      absentes: [],
      exclues: [],
    });

    expect(sql).toContain("`nom_complet` = 'Les Jets de l''Oise \\\\ Nord'");
    expect(sql).toContain("`nom` = 'Val d''Oise'");
  });

  it('ne contient aucune instruction quand il n’y a rien à mettre à jour', () => {
    const sql = versSql({ majs: [], dejaAJour: ['Rennes'], absentes: [], exclues: [] });

    expect(sql.split('\n').filter((l) => l && !l.startsWith('--'))).toEqual([]);
    expect(sql).toContain('Rien à mettre à jour');
  });
});

describe('lireCorrespondances', () => {
  it('lit le fichier d’exemple livré avec le script', () => {
    const exemple = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../scripts/equipes-referentiel/correspondance-noms.exemple.json',
        ),
        'utf8',
      ),
    );

    const lignes = lireCorrespondances(exemple);

    expect(lignes.length).toBeGreaterThan(0);
    for (const ligne of lignes) {
      expect(typeof ligne.nom).toBe('string');
      expect(typeof ligne.nomComplet).toBe('string');
    }
  });

  it('traite un champ manquant comme une chaîne vide (ligne ensuite exclue)', () => {
    expect(lireCorrespondances([{ nomComplet: 'Trois-Chêne' }, { nom: 'Rennes' }])).toEqual([
      { nom: '', nomComplet: 'Trois-Chêne' },
      { nom: 'Rennes', nomComplet: '' },
    ]);
  });

  it('refuse un contenu qui n’est pas un tableau', () => {
    expect(() => lireCorrespondances({ nom: 'Rennes' })).toThrow(/tableau JSON/);
  });

  it('refuse une valeur qui n’est pas une chaîne, en indiquant la ligne', () => {
    expect(() =>
      lireCorrespondances([
        { nom: 'Rennes', nomComplet: 'Les Cormorans de Rennes' },
        { nom: 12, nomComplet: 'x' },
      ]),
    ).toThrow(/Ligne 2/);
  });
});

describe('migration equipe_referentiel_nom_complet', () => {
  const sql = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../prisma/migrations/20261008000000_equipe_referentiel_nom_complet/migration.sql',
    ),
    'utf8',
  );
  const instructions = sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  it('ajoute la colonne facultative nom_complet VARCHAR(150), de façon rejouable (CA… schéma)', () => {
    expect(instructions[0]).toBe(
      'ALTER TABLE `insc_equipes_referentiel` ADD COLUMN IF NOT EXISTS `nom_complet` VARCHAR(150) NULL AFTER `nom`',
    );
  });

  it('crée l’index unique sur nom s’il manque, sous le nom attendu par Prisma (CA8)', () => {
    expect(instructions[1]).toBe(
      'CREATE UNIQUE INDEX IF NOT EXISTS `insc_equipes_referentiel_nom_key` ON `insc_equipes_referentiel` (`nom`)',
    );
  });

  it('est purement additive : deux instructions, aucune suppression ni modification de nom', () => {
    expect(instructions).toHaveLength(2);
    expect(sql).not.toMatch(/\bDROP\b|\bMODIFY\b|\bCHANGE\b|\bDELETE\b|\bUPDATE\b/i);
  });

  it('le schéma Prisma déclare nomComplet facultatif et laisse nom inchangé', () => {
    const schema = fs.readFileSync(
      path.resolve(__dirname, '../../prisma/schema.prisma'),
      'utf8',
    );
    const modele = schema.slice(
      schema.indexOf('model InscEquipeReferentiel {'),
      schema.indexOf('@@map("insc_equipes_referentiel")'),
    );

    expect(modele).toMatch(/nom\s+String\s+@unique\s+@db\.VarChar\(100\)/);
    expect(modele).toMatch(/nomComplet\s+String\?\s+@map\("nom_complet"\)\s+@db\.VarChar\(150\)/);
  });
});
