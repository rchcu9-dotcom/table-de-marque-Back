import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  buildTeamLogoUrl,
  slugifyTeamName,
} from '@/infrastructure/persistence/mysql/mysql-utils';
import { EquipeReferentiel } from '@/inscription/domain/entities/equipe-referentiel.entity';
import { toEquipeReferentielEntity } from '@/inscription/infrastructure/persistence/equipe-referentiel.mapper';

// docs/specs/-prise-en-compte-du-nom-court-pour-les-logos-contexte-actuel.md — CA1, CA2
// Le nom de fichier de logo dérive toujours et uniquement du nom court (`nom`).

const SRC_ROOT = join(__dirname, '../../src');

function listerSources(dossier: string): string[] {
  return readdirSync(dossier).flatMap((entree) => {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) return listerSources(chemin);
    return chemin.endsWith('.ts') && !chemin.endsWith('.spec.ts') ? [chemin] : [];
  });
}

function rawEquipe(nom: string, nomComplet: string | null) {
  return {
    id: 1,
    nom,
    nomComplet,
    logoUrl: null,
    active: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

describe('Logo — calculé depuis le nom court', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env.TEAM_LOGO_BASE_URL = 'https://cdn.example.com/logos';
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('équipe avec nom complet : le logo est celui du nom court (CA1)', () => {
    const equipe = toEquipeReferentielEntity(
      rawEquipe('Courbevoie', 'Les Coqs de Courbevoie'),
    );

    expect(buildTeamLogoUrl(equipe.nom)).toBe(
      'https://cdn.example.com/logos/courbevoie.png',
    );
  });

  it('équipe sans nom complet : le logo est celui du nom court (CA2)', () => {
    const equipe = toEquipeReferentielEntity(rawEquipe('Rennes', null));

    expect(equipe.nomComplet).toBeNull();
    expect(buildTeamLogoUrl(equipe.nom)).toBe('https://cdn.example.com/logos/rennes.png');
  });

  it('le nom complet donnerait un fichier qui n’existe pas : il ne doit jamais servir de source', () => {
    expect(slugifyTeamName('Les Coqs de Courbevoie')).toBe('les-coqs-de-courbevoie');
    expect(slugifyTeamName('Les Coqs de Courbevoie')).not.toBe(
      slugifyTeamName('Courbevoie'),
    );
  });

  it('aucun fichier source qui calcule un slug ou une URL de logo ne mentionne nomComplet', () => {
    const appelants = listerSources(SRC_ROOT).filter((fichier) =>
      /\b(buildTeamLogoUrl|slugifyTeamName)\b/.test(readFileSync(fichier, 'utf8')),
    );

    // Garde-fou du test lui-même : la recherche doit bien trouver les appelants connus.
    const noms = appelants.map((f) => relative(SRC_ROOT, f).replace(/\\/g, '/'));
    expect(noms).toEqual(
      expect.arrayContaining([
        'infrastructure/persistence/mysql/mysql-utils.ts',
        'infrastructure/persistence/mysql/mysql-equipe.repository.ts',
        'infrastructure/persistence/mysql/mysql-match.repository.ts',
      ]),
    );

    const fautifs = appelants.filter((fichier) =>
      /nomComplet|nom_complet/.test(readFileSync(fichier, 'utf8')),
    );
    expect(fautifs.map((f) => relative(SRC_ROOT, f))).toEqual([]);
  });
});

describe('toEquipeReferentielEntity — nomComplet', () => {
  it('place nomComplet et les autres champs au bon rang du constructeur', () => {
    const raw = {
      ...rawEquipe('Courbevoie', 'Les Coqs de Courbevoie'),
      id: 9,
      logoUrl: 'https://example.com/logo.png',
      active: false,
    };

    const equipe = toEquipeReferentielEntity(raw, true);

    expect(equipe).toBeInstanceOf(EquipeReferentiel);
    expect(equipe).toEqual({
      id: 9,
      nom: 'Courbevoie',
      nomComplet: 'Les Coqs de Courbevoie',
      logoUrl: 'https://example.com/logo.png',
      active: false,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      candidatureEnCours: true,
      nbCandidatures: 0,
    });
  });

  it('transmet un nomComplet null tel quel', () => {
    expect(toEquipeReferentielEntity(rawEquipe('Rennes', null)).nomComplet).toBeNull();
  });
});
