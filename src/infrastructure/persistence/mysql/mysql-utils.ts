export function normalizeKey(value: string): string {
  return (value ?? '').trim().toLowerCase();
}

export function toClassementDbGroupCode(input?: string | null): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  return trimmed;
}

export function toUiPouleCode(input?: string | null): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  const normalized = trimmed.toLowerCase();
  if (normalized === '1' || normalized === 'e' || normalized === 'alpha') return 'E';
  if (normalized === '2' || normalized === 'f' || normalized === 'beta') return 'F';
  if (normalized === '3' || normalized === 'g' || normalized === 'gamma') return 'G';
  if (normalized === '4' || normalized === 'h' || normalized === 'delta') return 'H';

  return trimmed.length === 1 ? trimmed.toUpperCase() : trimmed;
}

export function slugifyTeamName(value: string): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildTeamPhotoUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  return `https://lh3.googleusercontent.com/d/${match[1]}`;
}

export function buildTeamLogoUrl(teamName?: string | null): string | null {
  const base = (process.env.TEAM_LOGO_BASE_URL ?? '').trim();
  const slug = slugifyTeamName(teamName ?? '');
  if (!base || !slug) return null;
  if (base.endsWith('/')) return `${base}${slug}.png`;
  return `${base}/${slug}.png`;
}

export function pouleDisplayName(code?: string | null): string | null {
  if (!code) return null;

  const uiCode = toUiPouleCode(code);
  if (!uiCode) return null;

  if (uiCode === 'E') return 'Or E';
  if (uiCode === 'F') return 'Or F';
  if (uiCode === 'G') return 'Argent G';
  if (uiCode === 'H') return 'Argent H';
  if (uiCode === 'I') return 'Carré Or 1';
  if (uiCode === 'J') return 'Carré Or 5';
  if (uiCode === 'K') return 'Carré Argent 9';
  if (uiCode === 'L') return 'Carré Argent 13';
  if (uiCode.length === 1) return `Poule ${uiCode}`;

  return uiCode;
}
