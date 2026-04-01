export function toClassementGroupCode(day: string, group: string): string | null {
  const d = day.trim().toUpperCase();
  const g = group.trim();

  if (d === 'J1') {
    if (/^[ABCD]$/i.test(g)) return g.toUpperCase();
    return null;
  }

  if (d === 'J2') {
    if (g === 'Or A' || g === '1') return '1';
    if (g === 'Or B' || g === '2') return '2';
    if (g === 'Argent C' || g === '3') return '3';
    if (g === 'Argent D' || g === '4') return '4';
    return null;
  }

  if (d === 'J3') {
    // Phase1 standings: Or-side teams → E, Argent-side teams → F
    if (g === 'Carré Or A' || g === 'Or A' || g === 'E' || g === 'DemiOr' || g === 'Or') return 'E';
    if (g === 'Carré Or B' || g === 'Or B' || g === 'F' || g === 'DemiArgent' || g === 'Argent') return 'F';
    // Phase2 standings: losers → G, winners → J
    if (g === 'Carré Argent C' || g === 'Argent C' || g === 'G' || g === 'Perdants') return 'G';
    if (g === 'Carré Argent D' || g === 'Argent D' || g === 'H' || g === 'Vainqueurs') return 'J';
    return null;
  }

  return null;
}

export function j2DbGroupMapping(): Record<string, string> {
  return {
    'Or A': '1',
    'Or B': '2',
    'Argent C': '3',
    'Argent D': '4',
  };
}
