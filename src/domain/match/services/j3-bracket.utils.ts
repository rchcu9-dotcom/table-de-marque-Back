export const J3_SQUARE_CODES = ['I', 'J', 'K', 'L'] as const;

export type J3SquareCode = (typeof J3_SQUARE_CODES)[number];
export type J3TrajectoryType = 'phase1' | 'loser' | 'winner';
export type J3PoolCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
export type J3SeedRank = 1 | 2 | 3 | 4;
export type J3SeedCode = `${J3PoolCode}${J3SeedRank}`;
export type J3StableSlot = 1 | 2 | 3 | 4;

export type ParsedJ3ParticipantLabel = {
  type: J3TrajectoryType;
  pool: J3PoolCode;
  rank: J3SeedRank;
  seed: J3SeedCode;
  sourceSeeds: { left: J3SeedCode; right: J3SeedCode } | null;
  squareCode: J3SquareCode | null;
  stableSlot: J3StableSlot | null;
  canonicalId: string;
  displayLabel: string;
};

type CanonicalSeedPair = {
  left: J3SeedCode;
  right: J3SeedCode;
  squareCode: J3SquareCode;
  semiIndex: 1 | 2;
};

const DIRECT_SQUARE_PATTERNS: Array<[RegExp, J3SquareCode]> = [
  [/\bcarre\s+or\s*1\b/i, 'I'],
  [/\bcarre\s+or\s*5\b/i, 'J'],
  [/\bcarre\s+argent\s*9\b/i, 'K'],
  [/\bcarre\s+argent\s*13\b/i, 'L'],
  [/\bor\s*1-4\b/i, 'I'],
  [/\bor\s*5-8\b/i, 'J'],
  [/\bargent\s*9-12\b/i, 'K'],
  [/\bargent\s*13-16\b/i, 'L'],
  [/\bor\s*1\b/i, 'I'],
  [/\bor\s*5\b/i, 'J'],
  [/\bargent\s*1\b/i, 'K'],
  [/\bargent\s*5\b/i, 'L'],
];

// Real J3 numbering observed in the production-like test DB.
// This is the authoritative fallback when TA_MATCHS participants are already resolved.
const J3_REAL_SQUARE_BY_MATCH_NUMBER: Partial<Record<number, J3SquareCode>> = {
  61: 'L',
  62: 'L',
  63: 'K',
  64: 'K',
  66: 'J',
  67: 'J',
  68: 'I',
  69: 'I',
  71: 'L',
  72: 'L',
  73: 'K',
  74: 'K',
  76: 'J',
  77: 'J',
  81: 'I',
  83: 'I',
};

function normalizeAscii(value: string): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function inferJ3SquareCodeFromText(value: string): J3SquareCode | null {
  const normalized = normalizeAscii(value);
  for (const [pattern, squareCode] of DIRECT_SQUARE_PATTERNS) {
    if (pattern.test(normalized)) return squareCode;
  }
  return null;
}

export function inferJ3SquareCodeFromMatchNumber(
  matchNum: number,
): J3SquareCode | null {
  return J3_REAL_SQUARE_BY_MATCH_NUMBER[matchNum] ?? null;
}

export function parseJ3SeedCode(value: string): {
  pool: J3PoolCode;
  rank: J3SeedRank;
  seed: J3SeedCode;
  squareCode: J3SquareCode | null;
} | null {
  const match = String(value)
    .trim()
    .toUpperCase()
    .match(/^([A-H])([1-4])$/);
  if (!match) return null;
  const pool = match[1] as J3PoolCode;
  const rank = Number(match[2]) as J3SeedRank;
  return {
    pool,
    rank,
    seed: `${pool}${rank}`,
    squareCode: inferJ3SquareCodeFromPoolAndRank(pool, rank),
  };
}

export function inferJ3SquareCodeFromPoolAndRank(
  pool: J3PoolCode,
  rank: J3SeedRank,
): J3SquareCode | null {
  const isTopBucket = rank <= 2;
  if (pool === 'E' || pool === 'F') {
    return isTopBucket ? 'I' : 'K';
  }
  if (pool === 'G' || pool === 'H') {
    return isTopBucket ? 'J' : 'L';
  }
  return null;
}

export function canonicalizeJ3SeedPair(
  leftSeed: J3SeedCode,
  rightSeed: J3SeedCode,
): CanonicalSeedPair | null {
  const left = parseJ3SeedCode(leftSeed);
  const right = parseJ3SeedCode(rightSeed);
  if (!left || !right) return null;

  const ordered = [left, right].sort((a, b) =>
    a.pool.localeCompare(b.pool, 'fr-FR'),
  );
  const first = ordered[0];
  const second = ordered[1];
  const poolsKey = `${first.pool}${second.pool}`;

  if (!['EF', 'GH'].includes(poolsKey)) {
    return null;
  }

  const sameBucket =
    (first.rank <= 2 && second.rank <= 2) ||
    (first.rank >= 3 && second.rank >= 3);
  if (!sameBucket) return null;

  const squareCode = inferJ3SquareCodeFromPoolAndRank(first.pool, first.rank);
  if (!squareCode) return null;

  let semiIndex: 1 | 2 | null = null;
  if (first.rank === 2 && second.rank === 1) semiIndex = 1;
  if (first.rank === 1 && second.rank === 2) semiIndex = 2;
  if (first.rank === 4 && second.rank === 3) semiIndex = 1;
  if (first.rank === 3 && second.rank === 4) semiIndex = 2;
  if (!semiIndex) return null;

  return {
    left: first.seed,
    right: second.seed,
    squareCode,
    semiIndex,
  };
}

function stableSlotFromPair(
  type: Exclude<J3TrajectoryType, 'phase1'>,
  pair: CanonicalSeedPair,
): J3StableSlot {
  if (type === 'loser') {
    return pair.semiIndex === 1 ? 1 : 2;
  }
  return pair.semiIndex === 1 ? 3 : 4;
}

export function parseJ3ParticipantLabel(
  value: string,
): ParsedJ3ParticipantLabel | null {
  const seed = parseJ3SeedCode(value);
  if (seed) {
    return {
      type: 'phase1',
      pool: seed.pool,
      rank: seed.rank,
      seed: seed.seed,
      sourceSeeds: null,
      squareCode: seed.squareCode,
      stableSlot: null,
      canonicalId: `seed:${seed.seed}`,
      displayLabel: seed.seed,
    };
  }

  const trimmed = String(value).trim();
  const primary = trimmed.match(
    /^(Perd|Vain)\.?\s*([A-H][1-4])\s*-\s*([A-H][1-4])$/i,
  );
  const legacy = trimmed.match(/^([PV])([A-H][1-4])([A-H][1-4])$/i);
  if (!primary && !legacy) return null;

  const type =
    primary?.[1].toLowerCase() === 'perd' || legacy?.[1].toLowerCase() === 'p'
      ? 'loser'
      : 'winner';
  const rawLeft = (
    primary?.[2] ??
    legacy?.[2] ??
    ''
  ).toUpperCase() as J3SeedCode;
  const rawRight = (
    primary?.[3] ??
    legacy?.[3] ??
    ''
  ).toUpperCase() as J3SeedCode;
  const pair = canonicalizeJ3SeedPair(rawLeft, rawRight);
  if (!pair) return null;

  const left = parseJ3SeedCode(pair.left);
  if (!left) return null;

  return {
    type,
    pool: left.pool,
    rank: left.rank,
    seed: left.seed,
    sourceSeeds: { left: pair.left, right: pair.right },
    squareCode: pair.squareCode,
    stableSlot: stableSlotFromPair(type, pair),
    canonicalId: `${type === 'loser' ? 'loss' : 'win'}:${pair.left}-${pair.right}`,
    displayLabel: `${type === 'loser' ? 'Perd.' : 'Vain.'} ${pair.left}-${pair.right}`,
  };
}
