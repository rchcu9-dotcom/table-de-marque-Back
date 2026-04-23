import {
  slugifyTeamName,
  buildTeamLogoUrl,
  pouleDisplayName,
  toUiPouleCode,
  toClassementDbGroupCode,
  normalizeKey,
} from '@/infrastructure/persistence/mysql/mysql-utils';

describe('normalizeKey', () => {
  it('lowercases and trims the value', () => {
    expect(normalizeKey('  Lyon  ')).toBe('lyon');
    expect(normalizeKey('GRENOBLE')).toBe('grenoble');
    expect(normalizeKey('')).toBe('');
  });

  it('handles null/undefined gracefully', () => {
    expect(normalizeKey(null as unknown as string)).toBe('');
    expect(normalizeKey(undefined as unknown as string)).toBe('');
  });
});

describe('slugifyTeamName', () => {
  it('converts simple name to slug', () => {
    expect(slugifyTeamName('Lyon')).toBe('lyon');
    expect(slugifyTeamName('Paris')).toBe('paris');
  });

  it('handles accented characters', () => {
    expect(slugifyTeamName('Montréal')).toBe('montreal');
    expect(slugifyTeamName('Île-de-France')).toBe('ile-de-france');
  });

  it('replaces spaces and special chars with hyphens', () => {
    expect(slugifyTeamName('Team Alpha Beta')).toBe('team-alpha-beta');
    expect(slugifyTeamName('Team  A  B')).toBe('team-a-b');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugifyTeamName(' Lyon ')).toBe('lyon');
  });

  it('handles empty string', () => {
    expect(slugifyTeamName('')).toBe('');
  });

  it('handles null gracefully', () => {
    expect(slugifyTeamName(null as unknown as string)).toBe('');
  });
});

describe('buildTeamLogoUrl', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('returns null when base URL is not set', () => {
    process.env.TEAM_LOGO_BASE_URL = '';
    expect(buildTeamLogoUrl('Lyon')).toBeNull();
  });

  it('returns null when team name is empty', () => {
    process.env.TEAM_LOGO_BASE_URL = 'https://cdn.example.com/logos';
    expect(buildTeamLogoUrl('')).toBeNull();
    expect(buildTeamLogoUrl(null)).toBeNull();
    expect(buildTeamLogoUrl(undefined)).toBeNull();
  });

  it('builds URL with trailing slash on base', () => {
    process.env.TEAM_LOGO_BASE_URL = 'https://cdn.example.com/logos/';
    expect(buildTeamLogoUrl('Lyon')).toBe('https://cdn.example.com/logos/lyon.png');
  });

  it('builds URL without trailing slash on base', () => {
    process.env.TEAM_LOGO_BASE_URL = 'https://cdn.example.com/logos';
    expect(buildTeamLogoUrl('Lyon')).toBe('https://cdn.example.com/logos/lyon.png');
  });

  it('slugifies accented names', () => {
    process.env.TEAM_LOGO_BASE_URL = 'https://cdn.local/logos';
    expect(buildTeamLogoUrl('Montréal')).toBe('https://cdn.local/logos/montreal.png');
  });
});

describe('toClassementDbGroupCode', () => {
  it('passes through J2 pool codes E/F/G/H unchanged (DB stores E/F/G/H directly)', () => {
    expect(toClassementDbGroupCode('E')).toBe('E');
    expect(toClassementDbGroupCode('F')).toBe('F');
    expect(toClassementDbGroupCode('G')).toBe('G');
    expect(toClassementDbGroupCode('H')).toBe('H');
  });

  it('passes through any non-null/non-empty value unchanged', () => {
    expect(toClassementDbGroupCode('Alpha')).toBe('Alpha');
    expect(toClassementDbGroupCode('A')).toBe('A');
    expect(toClassementDbGroupCode('1')).toBe('1');
  });

  it('returns null for null/empty input', () => {
    expect(toClassementDbGroupCode(null)).toBeNull();
    expect(toClassementDbGroupCode('')).toBeNull();
    expect(toClassementDbGroupCode(undefined)).toBeNull();
  });
});

describe('toUiPouleCode', () => {
  it('maps DB code 1/2/3/4 to UI E/F/G/H', () => {
    expect(toUiPouleCode('1')).toBe('E');
    expect(toUiPouleCode('2')).toBe('F');
    expect(toUiPouleCode('3')).toBe('G');
    expect(toUiPouleCode('4')).toBe('H');
  });

  it('normalizes known legacy aliases to the new J2 codes', () => {
    expect(toUiPouleCode('alpha')).toBe('E');
    expect(toUiPouleCode('beta')).toBe('F');
  });

  it('returns poule code unchanged for J1 codes (A, B, etc.)', () => {
    expect(toUiPouleCode('A')).toBe('A');
    expect(toUiPouleCode('B')).toBe('B');
  });

  it('returns null for null/empty input', () => {
    expect(toUiPouleCode(null)).toBeNull();
    expect(toUiPouleCode('')).toBeNull();
    expect(toUiPouleCode(undefined)).toBeNull();
  });
});

describe('pouleDisplayName', () => {
  it('returns Or E/F and Argent G/H for the J2 pools', () => {
    expect(pouleDisplayName('E')).toBe('Or E');
    expect(pouleDisplayName('1')).toBe('Or E');
    expect(pouleDisplayName('F')).toBe('Or F');
    expect(pouleDisplayName('G')).toBe('Argent G');
    expect(pouleDisplayName('H')).toBe('Argent H');
  });

  it('returns Carré Or 1 / Carré Or 5 / Carré Argent 9 / Carré Argent 13 for J3 squares', () => {
    expect(pouleDisplayName('I')).toBe('Carré Or 1');
    expect(pouleDisplayName('J')).toBe('Carré Or 5');
    expect(pouleDisplayName('K')).toBe('Carré Argent 9');
    expect(pouleDisplayName('L')).toBe('Carré Argent 13');
  });

  it('returns Poule X for single-letter codes', () => {
    expect(pouleDisplayName('A')).toBe('Poule A');
    expect(pouleDisplayName('B')).toBe('Poule B');
    expect(pouleDisplayName('C')).toBe('Poule C');
  });

  it('returns the UI code as-is for multi-char non-J2 codes', () => {
    expect(pouleDisplayName('Or 1')).toBe('Or 1');
    expect(pouleDisplayName('Argent 5')).toBe('Argent 5');
  });

  it('returns null for null/empty input', () => {
    expect(pouleDisplayName(null)).toBeNull();
    expect(pouleDisplayName('')).toBeNull();
    expect(pouleDisplayName(undefined)).toBeNull();
  });
});
