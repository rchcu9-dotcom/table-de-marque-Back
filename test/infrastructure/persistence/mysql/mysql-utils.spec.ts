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
  it('maps UI Alpha to DB code 1', () => {
    expect(toClassementDbGroupCode('Alpha')).toBe('1');
    expect(toClassementDbGroupCode('alpha')).toBe('1');
  });

  it('maps UI Beta to DB code 2', () => {
    expect(toClassementDbGroupCode('Beta')).toBe('2');
  });

  it('maps UI Gamma to DB code 3', () => {
    expect(toClassementDbGroupCode('Gamma')).toBe('3');
  });

  it('maps UI Delta to DB code 4', () => {
    expect(toClassementDbGroupCode('Delta')).toBe('4');
  });

  it('returns the value unchanged if not a known J2 code', () => {
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
  it('maps DB code 1 to UI Alpha', () => {
    expect(toUiPouleCode('1')).toBe('Alpha');
  });

  it('maps DB code 2 to UI Beta', () => {
    expect(toUiPouleCode('2')).toBe('Beta');
  });

  it('maps DB code 3 to UI Gamma', () => {
    expect(toUiPouleCode('3')).toBe('Gamma');
  });

  it('maps DB code 4 to UI Delta', () => {
    expect(toUiPouleCode('4')).toBe('Delta');
  });

  it('capitalizes known UI code when passed as lowercase', () => {
    expect(toUiPouleCode('alpha')).toBe('Alpha');
    expect(toUiPouleCode('beta')).toBe('Beta');
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
  it('returns Tournoi Or - Alpha for Alpha', () => {
    expect(pouleDisplayName('Alpha')).toBe('Tournoi Or - Alpha');
    expect(pouleDisplayName('1')).toBe('Tournoi Or - Alpha');
  });

  it('returns Tournoi Or - Beta for Beta', () => {
    expect(pouleDisplayName('Beta')).toBe('Tournoi Or - Beta');
    expect(pouleDisplayName('2')).toBe('Tournoi Or - Beta');
  });

  it('returns Tournoi Argent - Gamma for Gamma', () => {
    expect(pouleDisplayName('Gamma')).toBe('Tournoi Argent - Gamma');
    expect(pouleDisplayName('3')).toBe('Tournoi Argent - Gamma');
  });

  it('returns Tournoi Argent - Delta for Delta', () => {
    expect(pouleDisplayName('Delta')).toBe('Tournoi Argent - Delta');
    expect(pouleDisplayName('4')).toBe('Tournoi Argent - Delta');
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
