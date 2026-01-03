/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unused-vars */
import { Injectable, Logger } from '@nestjs/common';
import { Match } from '@/domain/match/entities/match.entity';
import { MatchRepository } from '@/domain/match/repositories/match.repository';

type MatchStatus = Match['status'];

// Columns for the published CSV relative to column B..L (we'll shift if an empty col A is present)
const BASE_COLUMNS = {
  date: 0, // column B (HH:mm)
  status: 4, // column F ('', c, x)
  teamA: 5, // column G
  teamB: 8, // column J
  id: 10, // column L (numeric id)
  fallbackId: 3, // column E (match number) if L empty
  scoreA: 6, // column H
  scoreB: 7, // column I
  width: 11, // B..L
};

@Injectable()
export class GoogleSheetsPublicCsvMatchRepository implements MatchRepository {
  private readonly logger = new Logger(
    GoogleSheetsPublicCsvMatchRepository.name,
  );
  private readonly spreadsheetId: string;
  private readonly sheetName: string;
  private readonly gid?: string;
  private readonly range: string;
  private readonly directCsvUrl?: string;
  private readonly teamLogosCsvUrl?: string;
  private readonly startRow: number;
  private readonly endRow?: number;
  private readonly rangeAppliedToDirectCsv: boolean;
  private teamLogosCache?: Record<string, string | null>;
  private readonly classementCsvUrl?: string;
  private teamPouleCache?: Record<
    string,
    { pouleCode: string; pouleName: string }
  >;

  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? '';
    this.sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME ?? 'Matchs';
    this.gid = process.env.GOOGLE_SHEETS_GID;
    this.range = process.env.GOOGLE_SHEETS_RANGE ?? 'B3:L32';
    const profile = (process.env.SHEETS_PROFILE ?? 'prod').trim().toLowerCase();
    const prodCsvUrl = process.env.GOOGLE_SHEETS_CSV_URL;
    const testCsvUrl = process.env.GOOGLE_SHEETS_CSV_URL_TEST;
    this.directCsvUrl =
      profile === 'test' ? (testCsvUrl ?? prodCsvUrl) : prodCsvUrl;
    this.teamLogosCsvUrl =
      process.env.TEAM_LOGOS_CSV_URL ??
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vQEDjqyjswKcD9ZcPbkAGIrUf8zbGHGr-XnHYrNnBQX_HOAsdjU_PU0FgYCvdCDXEz5Xc90uGNP8CzQ/pub?gid=1961198584&single=true&output=csv';
    this.rangeAppliedToDirectCsv =
      !!this.directCsvUrl && this.directCsvUrl.toLowerCase().includes('range=');
    this.classementCsvUrl =
      process.env.GOOGLE_SHEETS_CLASSEMENT_CSV_URL ??
      (profile === 'test' ? (testCsvUrl ?? prodCsvUrl) : prodCsvUrl);
    const { start, end } = this.extractRangeBounds(this.range);
    this.startRow = start;
    this.endRow = end;

    if (!this.spreadsheetId && !this.directCsvUrl) {
      throw new Error(
        'Missing GOOGLE_SHEETS_SPREADSHEET_ID or GOOGLE_SHEETS_CSV_URL for public CSV repository.',
      );
    }
  }

  async create(match: Match): Promise<Match> {
    throw new Error('Public CSV repository is read-only.');
  }

  async update(match: Match): Promise<Match> {
    throw new Error('Public CSV repository is read-only.');
  }

  async delete(_id: string): Promise<void> {
    throw new Error('Public CSV repository is read-only.');
  }

  async findAll(): Promise<Match[]> {
    const url = this.withCacheBuster(this.buildCsvUrl());
    this.logger.debug(`Fetching matches CSV: ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch CSV: ${res.status} ${res.statusText}`);
    }
    const csv = await res.text();
    const rows = this.parseCsv(csv);

    const matches = rows
      .map((row, index) => this.mapRow(row, index))
      .filter((m): m is Match => !!m);

    const logos = await this.loadTeamLogos();
    const poules = await this.loadTeamPoules();
    this.logger.debug(
      `Enrichment: logos=${Object.keys(logos).length}, poules=${Object.keys(poules).length}`,
    );
    if (Object.keys(logos).length > 0) {
      matches.forEach((m) => {
        const keyA = this.normalizeTeamKey(m.teamA);
        const keyB = this.normalizeTeamKey(m.teamB);
        m.teamALogo = logos[keyA] ?? null;
        m.teamBLogo = logos[keyB] ?? null;
        const pouleA = poules[keyA];
        const pouleB = poules[keyB];
        // if both map to same, take it; otherwise prefer A then B
        const poule = pouleA ?? pouleB;
        if (poule) {
          m.pouleCode = poule.pouleCode;
          m.pouleName = poule.pouleName;
        }
      });
    }

    return matches;
  }

  async findById(id: string): Promise<Match | null> {
    const all = await this.findAll();
    return all.find((m) => m.id === id) ?? null;
  }

  private buildCsvUrl(): string {
    if (this.directCsvUrl) {
      return this.directCsvUrl;
    }
    // Prefer the export endpoint; supports format=csv and range. Use gid if provided, else sheet name in range.
    const base = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/export`;
    const params = new URLSearchParams({
      format: 'csv',
      range: `${this.sheetName}!${this.range}`,
    });
    if (this.gid) {
      params.set('gid', this.gid);
    }
    return `${base}?${params.toString()}`;
  }

  private withCacheBuster(url: string): string {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}cb=${Date.now()}`;
  }

  private mapRow(row: string[], index: number): Match | null {
    if (!row.length || row.every((cell) => cell === '')) {
      return null;
    }

    // Skip rows outside the requested bounds, whatever the source URL is
    const baseRowNumber =
      this.directCsvUrl && !this.rangeAppliedToDirectCsv ? 1 : this.startRow;
    const sheetRowNumber = baseRowNumber + index;
    if (sheetRowNumber < this.startRow) {
      return null;
    }
    if (this.endRow && sheetRowNumber > this.endRow) {
      return null;
    }

    // Normalize width; some exports include an empty leading column (offset = 1)
    const normalized = [...row];
    const offset = normalized[0] === '' ? 1 : 0;
    const columns = {
      date: BASE_COLUMNS.date + offset,
      status: BASE_COLUMNS.status + offset,
      teamA: BASE_COLUMNS.teamA + offset,
      teamB: BASE_COLUMNS.teamB + offset,
      id: BASE_COLUMNS.id + offset,
      fallbackId: BASE_COLUMNS.fallbackId + offset,
      scoreA: BASE_COLUMNS.scoreA + offset,
      scoreB: BASE_COLUMNS.scoreB + offset,
      width: BASE_COLUMNS.width + offset,
    };

    if (normalized.length < columns.width) {
      normalized.length = columns.width;
    }

    const rawId =
      normalized[columns.id] && normalized[columns.id] !== ''
        ? normalized[columns.id]
        : normalized[columns.fallbackId];
    const id = rawId && rawId !== '' ? String(rawId) : `row-${index}`;

    const dateRaw = normalized[columns.date];
    const teamA = normalized[columns.teamA] ?? '';
    const teamB = normalized[columns.teamB] ?? '';
    const statusRaw = normalized[columns.status] ?? '';

    // Skip surfacage or rows without teams
    if (
      (teamA === '' && teamB === '') ||
      teamA.toLowerCase().includes('surfac') ||
      teamB.toLowerCase().includes('surfac')
    ) {
      return null;
    }

    const status = this.sheetToStatus(statusRaw);
    const parsedDate = this.parseDate(dateRaw);
    const scoreA =
      status === 'ongoing' || status === 'finished'
        ? this.parseScore(normalized[columns.scoreA])
        : null;
    const scoreB =
      status === 'ongoing' || status === 'finished'
        ? this.parseScore(normalized[columns.scoreB])
        : null;

    return new Match(id, parsedDate, teamA, teamB, status, scoreA, scoreB);
  }

  private sheetToStatus(value: string): MatchStatus {
    const normalized = (value ?? '').trim().toLowerCase();
    if (normalized === 'c') return 'ongoing';
    if (normalized === 'x') return 'finished';
    return 'planned';
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
        // finalize row
        if (currentField !== '' || currentRow.length > 0) {
          currentRow.push(currentField);
          if (currentRow.some((c) => c !== '')) {
            rows.push(currentRow);
          }
        }
        currentRow = [];
        currentField = '';
        // skip paired \r\n
        if (char === '\r' && next === '\n') {
          i++;
        }
        continue;
      }

      currentField += char;
    }

    // flush last field/row
    if (currentField !== '' || currentRow.length > 0) {
      currentRow.push(currentField);
      if (currentRow.some((c) => c !== '')) {
        rows.push(currentRow);
      }
    }

    return rows;
  }

  private parseCsvLine(line: string): string[] {
    // Legacy parser not used in main flow; kept for fallback if needed
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    const separator = line.includes(',') ? ',' : line.includes(';') ? ';' : ',';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];

      if (char === '"' && inQuotes && next === '"') {
        current += '"';
        i++;
        continue;
      }

      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (char === separator && !inQuotes) {
        result.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    result.push(current);
    return result;
  }

  private extractRangeBounds(range: string): { start: number; end?: number } {
    const match = range.match(/[A-Z]+(\d+):[A-Z]+(\d+)/i);
    if (match && match[1]) {
      return {
        start: parseInt(match[1], 10),
        end: match[2] ? parseInt(match[2], 10) : undefined,
      };
    }
    const startOnly = range.match(/[A-Z]+(\d+)/i);
    if (startOnly && startOnly[1]) {
      return { start: parseInt(startOnly[1], 10) };
    }
    return { start: 1 };
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
      // thumbnail endpoint is generally more reliable for img tags
      return `https://drive.google.com/thumbnail?id=${id}&sz=w600`;
    }
    return url;
  }

  private normalizeTeamKey(name: string): string {
    return name.trim().toLowerCase();
  }

  private parseDate(value: string | undefined): Date {
    if (!value) return new Date();
    const timeMatch = value.match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
      const now = new Date();
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        hours,
        minutes,
      );
    }
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
    return new Date();
  }

  private parseScore(value: string | undefined): number | null {
    if (value === undefined) return null;
    const n = Number(String(value).replace(',', '.').trim());
    return isNaN(n) ? null : n;
  }

  private async loadTeamPoules(): Promise<
    Record<string, { pouleCode: string; pouleName: string }>
  > {
    if (this.teamPouleCache) return this.teamPouleCache;
    if (!this.classementCsvUrl) {
      this.teamPouleCache = {};
      return this.teamPouleCache;
    }

    const res = await fetch(this.classementCsvUrl);
    if (!res.ok) {
      this.teamPouleCache = {};
      return this.teamPouleCache;
    }
    const csv = await res.text();
    const rows = this.parseCsv(csv);
    const map: Record<string, { pouleCode: string; pouleName: string }> = {};

    const ranges = [
      { code: 'A', startRow: 4, endRow: 9, nameRow: 3 }, // Poule A (N5:W10, label row 4)
      { code: 'B', startRow: 13, endRow: 18, nameRow: 12 }, // Poule B (N14:W19, label row 13)
    ];
    const START_COL = 13; // Column N (0-based)
    const END_COL = 22; // Column W (0-based)
    const POULE_NAME_COL = 14; // Column O (0-based)

    ranges.forEach((range) => {
      const pouleName =
        rows[range.nameRow]?.[POULE_NAME_COL]?.trim() || `Poule ${range.code}`;

      for (
        let rowIndex = range.startRow;
        rowIndex <= range.endRow;
        rowIndex++
      ) {
        const row = rows[rowIndex] ?? [];
        const slice = row.slice(START_COL, END_COL + 1);
        if (slice.every((cell) => cell === '' || cell === undefined)) continue;
        const name = (slice[1] ?? '').trim();
        if (!name) continue;
        const key = this.normalizeTeamKey(name);
        map[key] = { pouleCode: String(range.code), pouleName };
      }
    });

    this.teamPouleCache = map;
    return map;
  }
}
