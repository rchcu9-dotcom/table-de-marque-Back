import { Injectable } from '@nestjs/common';
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
  private readonly spreadsheetId: string;
  private readonly sheetName: string;
  private readonly gid?: string;
  private readonly range: string;
  private readonly directCsvUrl?: string;
  private readonly startRow: number;
  private readonly endRow?: number;

  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? '';
    this.sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME ?? 'Matchs';
    this.gid = process.env.GOOGLE_SHEETS_GID;
    this.range = process.env.GOOGLE_SHEETS_RANGE ?? 'B3:L32';
    this.directCsvUrl = process.env.GOOGLE_SHEETS_CSV_URL;
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
    const url = this.buildCsvUrl();
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch CSV: ${res.status} ${res.statusText}`);
    }
    const csv = await res.text();
    const rows = this.parseCsv(csv);

    return rows
      .map((row, index) => this.mapRow(row, index))
      .filter((m): m is Match => !!m);
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

  private mapRow(row: string[], index: number): Match | null {
    if (!row.length || row.every((cell) => cell === '')) {
      return null;
    }

    // Skip rows above the requested start row (range start)
    const csvRowNumber = index + 1;
    if (csvRowNumber < this.startRow) {
      return null;
    }
    if (this.endRow && csvRowNumber > this.endRow) {
      return null;
    }

    // Normalize width
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
    const separator =
      line.includes(',') ? ',' : line.includes(';') ? ';' : ',';

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
      return { start: parseInt(match[1], 10), end: match[2] ? parseInt(match[2], 10) : undefined };
    }
    const startOnly = range.match(/[A-Z]+(\d+)/i);
    if (startOnly && startOnly[1]) {
      return { start: parseInt(startOnly[1], 10) };
    }
    return { start: 1 };
  }

  private parseDate(value: string | undefined): Date {
    if (!value) return new Date();
    const timeMatch = value.match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
      const now = new Date();
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
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
}
