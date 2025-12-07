import { Injectable } from '@nestjs/common';
import { Equipe, PouleClassement, PouleCode } from '@/domain/equipe/entities/equipe.entity';
import { EquipeRepository } from '@/domain/equipe/repositories/equipe.repository';

type CacheEntry = {
  timestamp: number;
  poules: Record<string, PouleClassement>;
};

const POULE_A_RANGE = { startRow: 4, endRow: 9, nameRow: 3 }; // N5:W10, label in O4
const POULE_B_RANGE = { startRow: 13, endRow: 18, nameRow: 12 }; // N14:W19, label in O13
const START_COL = 13; // Column N (0-based)
const END_COL = 22; // Column W (0-based)
const POULE_NAME_COL = 14; // Column O (0-based)

@Injectable()
export class GoogleSheetsPublicCsvEquipeRepository
  implements EquipeRepository
{
  private readonly classementCsvUrl: string;
  private readonly cacheTtlMs: number;
  private cache?: CacheEntry;
  private readonly teamLogosCsvUrl?: string;
  private teamLogosCache?: Record<string, string | null>;

  constructor() {
    const profile = (process.env.SHEETS_PROFILE ?? 'prod').trim().toLowerCase();
    const prodCsvUrl = process.env.GOOGLE_SHEETS_CSV_URL ?? '';
    const testCsvUrl = process.env.GOOGLE_SHEETS_CSV_URL_TEST ?? '';
    this.classementCsvUrl =
      process.env.GOOGLE_SHEETS_CLASSEMENT_CSV_URL ??
      (profile === 'test' ? testCsvUrl || prodCsvUrl : prodCsvUrl) ??
      '';
    this.cacheTtlMs = Number(process.env.EQUIPE_CACHE_TTL_MS ?? '60000');
    this.teamLogosCsvUrl =
      process.env.TEAM_LOGOS_CSV_URL ??
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vQEDjqyjswKcD9ZcPbkAGIrUf8zbGHGr-XnHYrNnBQX_HOAsdjU_PU0FgYCvdCDXEz5Xc90uGNP8CzQ/pub?gid=1961198584&single=true&output=csv';

    if (!this.classementCsvUrl) {
      throw new Error(
        'Missing GOOGLE_SHEETS_CLASSEMENT_CSV_URL or GOOGLE_SHEETS_CSV_URL for Equipe repository.',
      );
    }
  }

  async findClassementByPoule(code: PouleCode): Promise<PouleClassement | null> {
    const normalized = String(code).trim().toUpperCase();
    const poules = await this.loadClassements();
    return poules[normalized] ?? null;
  }

  async findClassementByTeamName(teamName: string): Promise<PouleClassement | null> {
    const poules = await this.loadClassements();
    const targetKey = this.normalizeTeamKey(teamName);
    return (
      Object.values(poules).find((poule) =>
        poule.equipes.some(
          (eq) => this.normalizeTeamKey(eq.name) === targetKey,
        ),
      ) ?? null
    );
  }

  private async loadClassements(): Promise<Record<string, PouleClassement>> {
    if (this.cache && Date.now() - this.cache.timestamp < this.cacheTtlMs) {
      return this.cache.poules;
    }

    const res = await fetch(this.classementCsvUrl);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch classement CSV: ${res.status} ${res.statusText}`,
      );
    }
    const csv = await res.text();
    const rows = this.parseCsv(csv);

    const poules: Record<string, PouleClassement> = {};
    const logos = await this.loadTeamLogos();

    poules['A'] = this.extractPoule(rows, 'A', POULE_A_RANGE, logos);
    poules['B'] = this.extractPoule(rows, 'B', POULE_B_RANGE, logos);

    this.cache = { timestamp: Date.now(), poules };
    return poules;
  }

  private extractPoule(
    rows: string[][],
    code: PouleCode,
    range: { startRow: number; endRow: number; nameRow: number },
    logos: Record<string, string | null>,
  ): PouleClassement {
    const pouleName =
      rows[range.nameRow]?.[POULE_NAME_COL]?.trim() || `Poule ${code}`;

    const equipes: Equipe[] = [];
    for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex++) {
      const row = rows[rowIndex] ?? [];
      const slice = row.slice(START_COL, END_COL + 1);
      if (slice.every((cell) => cell === '' || cell === undefined)) {
        continue;
      }

      const [
        rangRaw,
        nameRaw,
        jouesRaw,
        victoiresRaw,
        nulsRaw,
        defaitesRaw,
        pointsRaw,
        bpRaw,
        bcRaw,
        diffRaw,
      ] = slice;

      const name = (nameRaw ?? '').trim();
      if (!name) {
        continue;
      }

      const bp = this.toNumber(bpRaw);
      const bc = this.toNumber(bcRaw);
      const diff =
        this.toNumber(diffRaw, bp - bc) ??
        (Number.isFinite(bp) && Number.isFinite(bc) ? bp - bc : 0);

      const logoUrl = logos[this.normalizeTeamKey(name)] ?? null;

      equipes.push(
        new Equipe(
          name,
          name,
          logoUrl,
          code,
          pouleName,
          this.toNumber(rangRaw, equipes.length + 1),
          this.toNumber(jouesRaw),
          this.toNumber(victoiresRaw),
          this.toNumber(nulsRaw),
          this.toNumber(defaitesRaw),
          this.toNumber(pointsRaw),
          bp,
          bc,
          diff,
        ),
      );
    }

    return { pouleCode: code, pouleName, equipes };
  }

  private toNumber(value: string | number | undefined, fallback = 0): number {
    if (value === undefined || value === null) return fallback;
    const n = Number(String(value).replace(',', '.').trim());
    return Number.isNaN(n) ? fallback : n;
  }

  private normalizeTeamKey(name: string): string {
    return (name ?? '').trim().toLowerCase();
  }

  private async loadTeamLogos(): Promise<Record<string, string | null>> {
    if (!this.teamLogosCsvUrl) return {};
    if (this.teamLogosCache) return this.teamLogosCache;

    const res = await fetch(this.teamLogosCsvUrl);
    if (!res.ok) {
      this.teamLogosCache = {};
      return this.teamLogosCache;
    }
    const csv = await res.text();
    const rows = this.parseCsv(csv);
    const map: Record<string, string | null> = {};

    rows.forEach((row) => {
      const name = row[1]?.trim();
      const image = row[3]?.trim();
      if (!name) return;
      const key = this.normalizeTeamKey(name);
      map[key] = image ? this.normalizeDriveUrl(image) : null;
    });

    this.teamLogosCache = map;
    return map;
  }

  private normalizeDriveUrl(url: string): string {
    const match = url.match(/\/file\/d\/([^/]+)\//);
    if (match && match[1]) {
      const id = match[1];
      return `https://drive.google.com/thumbnail?id=${id}&sz=w600`;
    }
    return url;
  }

  private parseCsv(csv: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < csv.length; i++) {
      const char = csv[i];
      const next = csv[i + 1];

      if (char === '"' && inQuotes && next === '"') {
        currentField += '"';
        i++;
        continue;
      }

      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if ((char === ',' || char === ';') && !inQuotes) {
        currentRow.push(currentField);
        currentField = '';
        continue;
      }

      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (currentField !== '' || currentRow.length > 0) {
          currentRow.push(currentField);
          if (currentRow.some((c) => c !== '')) {
            rows.push(currentRow);
          }
        }
        currentRow = [];
        currentField = '';
        if (char === '\r' && next === '\n') {
          i++;
        }
        continue;
      }

      currentField += char;
    }

    if (currentField !== '' || currentRow.length > 0) {
      currentRow.push(currentField);
      if (currentRow.some((c) => c !== '')) {
        rows.push(currentRow);
      }
    }

    return rows;
  }
}
