import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// docs/specs/-impact-sur-les-pages-publiques-contexte-les-pages-publiques.md — §4, CA2
// Le nom complet d'une équipe appartient au référentiel d'inscription. Aucune route
// publique du tournoi (équipes, classement, matchs, challenge) ne peut le renvoyer si
// aucun fichier hors du module `inscription` ne le connaît : c'est ce que vérifie ce test.

const SRC_ROOT = join(__dirname, '../../src');

/** Seuls fichiers de back/src (hors tests) autorisés à mentionner nomComplet. */
const AUTORISES = [
  // Données de démonstration : champ informatif, lu par personne.
  'hooks/mock-teams.data.ts',
  // Référentiel d'inscription.
  'inscription/application/candidature/get-toutes-candidatures.usecase.ts',
  'inscription/application/equipe/create-equipe-referentiel.usecase.ts',
  'inscription/application/equipe/dto/create-equipe-referentiel.dto.ts',
  'inscription/application/equipe/dto/update-equipe-referentiel.dto.ts',
  'inscription/application/equipe/update-equipe-referentiel.usecase.ts',
  'inscription/domain/entities/equipe-referentiel.entity.ts',
  'inscription/domain/equipe-referentiel-corrections.ts',
  'inscription/domain/equipe-referentiel-noms.ts',
  'inscription/infrastructure/http/equipe-referentiel.controller.ts',
  'inscription/infrastructure/persistence/equipe-referentiel.mapper.ts',
];

function listerSources(dossier: string): string[] {
  return readdirSync(dossier).flatMap((entree) => {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) return listerSources(chemin);
    return chemin.endsWith('.ts') && !chemin.endsWith('.spec.ts')
      ? [chemin]
      : [];
  });
}

const relatif = (chemin: string) =>
  relative(SRC_ROOT, chemin).split('\\').join('/');

describe('Périmètre du nom complet dans le back', () => {
  const mentionnent = listerSources(SRC_ROOT)
    .filter((chemin) => /nom_?complet/i.test(readFileSync(chemin, 'utf8')))
    .map(relatif)
    .sort();

  it('n’est mentionné que par le module inscription et les données de démonstration', () => {
    // Égalité dans les deux sens : un fichier nouveau échoue, une entrée devenue inutile aussi.
    expect(mentionnent).toEqual([...AUTORISES].sort());
  });

  it.each([
    'domain/equipe',
    'domain/match',
    'domain/challenge',
    'application/equipe',
    'application/match',
    'application/challenge',
    'infrastructure/http',
    'infrastructure/persistence',
    'infrastructure/cache',
  ])('aucun fichier de %s ne le connaît', (dossier) => {
    expect(mentionnent.filter((f) => f.startsWith(`${dossier}/`))).toEqual([]);
  });

  it('les données de démonstration ne l’utilisent ni pour un nom affiché ni pour un slug', () => {
    const hooks = listerSources(join(SRC_ROOT, 'hooks')).filter(
      (chemin) => !chemin.endsWith('mock-teams.data.ts'),
    );

    for (const chemin of hooks) {
      expect(readFileSync(chemin, 'utf8')).not.toMatch(/nomComplet/);
    }
  });
});
