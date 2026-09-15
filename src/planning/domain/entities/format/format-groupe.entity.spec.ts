import { FormatGroupe, mecaniqueGroupe } from './format-groupe.entity';
import { FormatPlace } from './format-place.entity';
import { FormatGroupeFormule } from '../../enums/format-groupe-formule.enum';

function places(n: number): FormatPlace[] {
  return Array.from(
    { length: n },
    (_, i) => new FormatPlace(i + 1, 10, i + 1, 'ALIAS', `Équipe ${i + 1}`, null),
  );
}

describe('mecaniqueGroupe', () => {
  it('retourne MATCH_UNIQUE pour un groupe à 2 places, quelle que soit la formule configurée', () => {
    const groupe = new FormatGroupe(10, 1, 'Demi 1', 1, places(2), FormatGroupeFormule.RONDE_SUISSE);
    expect(mecaniqueGroupe(groupe)).toBe('MATCH_UNIQUE');
  });

  it('retourne CHAMPIONNAT par défaut pour un groupe de ≥3 places quand formule est omise (CA1, non-régression)', () => {
    const groupe = new FormatGroupe(10, 1, 'Poule A', 1, places(3));
    expect(mecaniqueGroupe(groupe)).toBe('CHAMPIONNAT');
  });

  it('retourne CHAMPIONNAT pour un groupe de ≥3 places explicitement configuré en CHAMPIONNAT', () => {
    const groupe = new FormatGroupe(10, 1, 'Poule A', 1, places(4), FormatGroupeFormule.CHAMPIONNAT);
    expect(mecaniqueGroupe(groupe)).toBe('CHAMPIONNAT');
  });

  it('retourne RONDE_SUISSE pour un groupe de ≥3 places configuré en RONDE_SUISSE (CA2)', () => {
    const groupe = new FormatGroupe(10, 1, 'Poule A', 1, places(5), FormatGroupeFormule.RONDE_SUISSE);
    expect(mecaniqueGroupe(groupe)).toBe('RONDE_SUISSE');
  });
});
