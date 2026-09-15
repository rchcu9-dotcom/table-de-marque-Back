import {
  parsePoulePlaceholder,
  parseGroupePlaceholder,
} from './placeholder-ref.parser';

describe('parsePoulePlaceholder', () => {
  it('décompose une ref de rang de poule valide', () => {
    expect(parsePoulePlaceholder('placeholder:poule-A-rang-1')).toEqual({
      pouleCode: 'A',
      rangPoule: 1,
    });
  });

  it('gère un rang à plusieurs chiffres et une poule à plusieurs lettres', () => {
    expect(parsePoulePlaceholder('placeholder:poule-AB-rang-12')).toEqual({
      pouleCode: 'AB',
      rangPoule: 12,
    });
  });

  it('retourne null pour une ref de vainqueur de bracket', () => {
    expect(parsePoulePlaceholder('placeholder:vainqueur-t1-m1')).toBeNull();
  });

  it('retourne null pour une ref déjà résolue (nom réel, pas de préfixe placeholder)', () => {
    expect(parsePoulePlaceholder('real:1')).toBeNull();
  });

  it('retourne null pour une chaîne vide', () => {
    expect(parsePoulePlaceholder('')).toBeNull();
  });

  it('retourne null si le rang est absent', () => {
    expect(parsePoulePlaceholder('placeholder:poule-A-rang-')).toBeNull();
  });
});

describe('parseGroupePlaceholder', () => {
  it('décompose une ref de rang de groupe valide', () => {
    expect(parseGroupePlaceholder('placeholder:groupe-42-rang-1')).toEqual({
      groupeId: 42,
      rang: 1,
    });
  });

  it('gère un groupeId et un rang à plusieurs chiffres', () => {
    expect(parseGroupePlaceholder('placeholder:groupe-123-rang-45')).toEqual({
      groupeId: 123,
      rang: 45,
    });
  });

  it('retourne null pour une ref de poule (autre format généralisé)', () => {
    expect(parseGroupePlaceholder('placeholder:poule-A-rang-1')).toBeNull();
  });

  it('retourne null pour une ref déjà résolue (nom réel, pas de préfixe placeholder)', () => {
    expect(parseGroupePlaceholder('real:1')).toBeNull();
  });

  it('retourne null pour une chaîne vide', () => {
    expect(parseGroupePlaceholder('')).toBeNull();
  });
});
