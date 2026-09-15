import { NumeroMatchAllocator } from './numero-match-allocator';

describe('NumeroMatchAllocator', () => {
  it('démarre à 1 pour le 5v5 quand aucun match existant', () => {
    const allocator = new NumeroMatchAllocator(0, 100);
    expect(allocator.suivant(false)).toBe(1);
    expect(allocator.suivant(false)).toBe(2);
  });

  it('démarre à 101 pour le 3v3 quand aucun match existant', () => {
    const allocator = new NumeroMatchAllocator(0, 100);
    expect(allocator.suivant(true)).toBe(101);
    expect(allocator.suivant(true)).toBe(102);
  });

  it('reprend après le max 5v5 existant', () => {
    const allocator = new NumeroMatchAllocator(42, 100);
    expect(allocator.suivant(false)).toBe(43);
  });

  it('reprend après le max 3v3 existant', () => {
    const allocator = new NumeroMatchAllocator(0, 150);
    expect(allocator.suivant(true)).toBe(151);
  });

  it('alloue indépendamment 5v5 et 3v3 en alternance', () => {
    const allocator = new NumeroMatchAllocator(0, 100);
    expect(allocator.suivant(false)).toBe(1);
    expect(allocator.suivant(true)).toBe(101);
    expect(allocator.suivant(false)).toBe(2);
    expect(allocator.suivant(true)).toBe(102);
  });
});
