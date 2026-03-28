export function normalizeKey(value: string): string {
  return (value ?? '').trim().toLowerCase();
}

const J2_UI_TO_DB: Record<string, '1' | '2' | '3' | '4'> = {
  alpha: '1',
  beta: '2',
  gamma: '3',
  delta: '4',
};

const J2_DB_TO_UI: Record<'1' | '2' | '3' | '4', 'Alpha' | 'Beta' | 'Gamma' | 'Delta'> = {
  '1': 'Alpha',
  '2': 'Beta',
  '3': 'Gamma',
  '4': 'Delta',
};

export function toClassementDbGroupCode(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const normalized = normalizeKey(trimmed);
  if (normalized in J2_UI_TO_DB) return J2_UI_TO_DB[normalized];
  return trimmed;
}

export function toUiPouleCode(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed in J2_DB_TO_UI) {
    return J2_DB_TO_UI[trimmed as keyof typeof J2_DB_TO_UI];
  }
  const normalized = normalizeKey(trimmed);
  if (normalized in J2_UI_TO_DB) {
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
  return trimmed;
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
  if (uiCode === 'Alpha') return 'Tournoi Or - Alpha';
  if (uiCode === 'Beta') return 'Tournoi Or - Beta';
  if (uiCode === 'Gamma') return 'Tournoi Argent - Gamma';
  if (uiCode === 'Delta') return 'Tournoi Argent - Delta';
  if (uiCode === 'E') return 'Carré Or A';
  if (uiCode === 'F') return 'Carré Or B';
  if (uiCode === 'G') return 'Carré Argent C';
  if (uiCode === 'H') return 'Carré Argent D';
  if (uiCode.length === 1) return `Poule ${uiCode}`;
  return uiCode;
}
