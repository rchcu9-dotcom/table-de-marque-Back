export function normalizeKey(value: string): string {
  return (value ?? '').trim().toLowerCase();
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

export function buildTeamLogoUrl(teamName?: string | null): string | null {
  const base = (process.env.TEAM_LOGO_BASE_URL ?? '').trim();
  const slug = slugifyTeamName(teamName ?? '');
  if (!base || !slug) return null;
  if (base.endsWith('/')) return `${base}${slug}.png`;
  return `${base}/${slug}.png`;
}

export function pouleDisplayName(code?: string | null): string | null {
  if (!code) return null;
  const trimmed = code.trim();
  if (!trimmed) return null;
  if (trimmed.length === 1) return `Poule ${trimmed}`;
  return trimmed;
}
