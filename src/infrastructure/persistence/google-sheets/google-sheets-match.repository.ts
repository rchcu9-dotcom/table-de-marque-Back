import { Injectable, Logger } from '@nestjs/common';
import { google, sheets_v4 } from 'googleapis';
import { v4 as uuid } from 'uuid';
import * as fs from 'node:fs';

import { Match } from '@/domain/match/entities/match.entity';
import { MatchRepository } from '@/domain/match/repositories/match.repository';

type MatchStatus = Match['status'];
type ServiceAccountKey = { client_email?: string; private_key?: string };

// Columns within the selected range (B..L)
const SHEET_COLUMNS = {
  date: 0, // B
  status: 4, // F
  teamA: 5, // G
  teamB: 8, // J
  scoreA: 6, // H
  scoreB: 7, // I
  fallbackId: 3, // E
  id: 10, // L
  width: 11, // B -> L inclusive
};

@Injectable()
export class GoogleSheetsMatchRepository implements MatchRepository {
  private readonly logger = new Logger(GoogleSheetsMatchRepository.name);
  private readonly sheets: sheets_v4.Sheets;
  private readonly spreadsheetId: string;
  private readonly range: string;
  private readonly startRow: number;
  private readonly startColumn: string;
  private readonly endColumn: string;
  private readonly teamLogosCsvUrl?: string;
  private readonly classementCsvUrl?: string;
  private teamLogosCache?: Record<string, string | null>;
  private teamPouleCache?: Record<
    string,
    { pouleCode: string; pouleName: string }
  >;

  constructor() {
    const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    let clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
    let privateKey = '';

    if (keyFile) {
      const raw = fs.readFileSync(keyFile, 'utf8');
      const json = JSON.parse(raw) as ServiceAccountKey;
      clientEmail = json.client_email ?? clientEmail;
      privateKey = this.normalizePrivateKey(json.private_key ?? '', '');
    } else {
      const rawKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY ?? '';
      const b64Key = process.env.GOOGLE_SHEETS_PRIVATE_KEY_BASE64 ?? '';
      privateKey = this.normalizePrivateKey(rawKey, b64Key);
    }
    const profileSheet = (process.env.SHEETS_PROFILE ?? 'prod')
      .trim()
      .toLowerCase();
    const sheetIdProd = process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? '';
    const sheetIdTest =
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID_TEST ?? sheetIdProd;
    this.spreadsheetId = profileSheet === 'test' ? sheetIdTest : sheetIdProd;
    this.range = process.env.GOOGLE_SHEETS_RANGE ?? 'Matchs!B3:L54';
    const parsedRange = this.parseRange(this.range);
    this.startRow = parsedRange.startRow;
    this.startColumn = parsedRange.startColumn;
    this.endColumn = parsedRange.endColumn;

    if (!clientEmail || !privateKey || !this.spreadsheetId) {
      throw new Error(
        'Google Sheets credentials missing (GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY, GOOGLE_SHEETS_SPREADSHEET_ID).',
      );
    }

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.sheets = google.sheets({ version: 'v4', auth });

    this.teamLogosCsvUrl =
      process.env.TEAM_LOGOS_CSV_URL ??
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vQEDjqyjswKcD9ZcPbkAGIrUf8zbGHGr-XnHYrNnBQX_HOAsdjU_PU0FgYCvdCDXEz5Xc90uGNP8CzQ/pub?gid=1961198584&single=true&output=csv';
    const profile = (process.env.SHEETS_PROFILE ?? 'prod').trim().toLowerCase();
    const prodCsvUrl = process.env.GOOGLE_SHEETS_CSV_URL;
    const testCsvUrl = process.env.GOOGLE_SHEETS_CSV_URL_TEST;
    this.classementCsvUrl =
      process.env.GOOGLE_SHEETS_CLASSEMENT_CSV_URL ??
      (profile === 'test' ? (testCsvUrl ?? prodCsvUrl) : prodCsvUrl);
  }

  async create(match: Match): Promise<Match> {
    const payload = this.toRow(match);

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: this.range,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [payload] },
    });

    return match;
  }

  async findAll(): Promise<Match[]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: this.range,
    });

    const rows = (response.data.values ?? []) as string[][];
    const matches = rows
      .map((row, index) => this.mapRow(row, index))
      .filter((match): match is Match => !!match);

    const logos = await this.loadTeamLogos();
    const poules = await this.loadTeamPoules();
    this.logger.debug(
      `Enrichment (API driver): logos=${Object.keys(logos).length}, poules=${Object.keys(poules).length}`,
    );
    if (Object.keys(logos).length > 0) {
      matches.forEach((m) => {
        const keyA = this.normalizeTeamKey(m.teamA);
        const keyB = this.normalizeTeamKey(m.teamB);
        m.teamALogo = logos[keyA] ?? null;
        m.teamBLogo = logos[keyB] ?? null;
        const pouleA = poules[keyA];
        const pouleB = poules[keyB];
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

  async update(match: Match): Promise<Match> {
    const all = await this.findAll();
    const index = all.findIndex((m) => m.id === match.id);

    if (index === -1) {
      await this.create(match);
      return match;
    }

    const rowNumber = this.startRow + index;
    const targetRange = this.getRowRange(rowNumber);
    const payload = this.toRow(match);

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: targetRange,
      valueInputOption: 'RAW',
      requestBody: { values: [payload] },
    });

    return match;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      return;
    }

    existing.status = 'deleted';
    await this.update(existing);
  }

  private toRow(match: Match): string[] {
    const row = new Array(SHEET_COLUMNS.width).fill('');
    row[SHEET_COLUMNS.date] = match.date.toISOString();
    row[SHEET_COLUMNS.status] = this.statusToSheet(match.status);
    row[SHEET_COLUMNS.teamA] = match.teamA;
    row[SHEET_COLUMNS.teamB] = match.teamB;
    row[SHEET_COLUMNS.id] = match.id ?? uuid();
    return row;
  }

  private mapRow(row: string[], index: number): Match | null {
    // Normalize row width to account for trailing empty cells trimmed by Sheets API
    const normalized = [...row];
    if (normalized.length < SHEET_COLUMNS.width) {
      normalized.length = SHEET_COLUMNS.width;
    }

    const hasContent = normalized.some((cell) => !!cell);
    if (!hasContent) {
      return null;
    }

    const id =
      normalized[SHEET_COLUMNS.id] && normalized[SHEET_COLUMNS.id] !== ''
        ? normalized[SHEET_COLUMNS.id]
        : `row-${this.startRow + index}`;

    const dateRaw = normalized[SHEET_COLUMNS.date];
    const teamA = normalized[SHEET_COLUMNS.teamA] ?? '';
    const teamB = normalized[SHEET_COLUMNS.teamB] ?? '';
    const statusRaw = normalized[SHEET_COLUMNS.status] ?? '';

    if (
      (teamA === '' && teamB === '') ||
      teamA.toLowerCase().includes('surfac') ||
      teamB.toLowerCase().includes('surfac')
    ) {
      return null;
    }

    const status = this.sheetToStatus(statusRaw);
    const date = this.parseDate(dateRaw);
    const scoreA =
      status === 'ongoing' || status === 'finished'
        ? this.parseScore(normalized[SHEET_COLUMNS.scoreA])
        : null;
    const scoreB =
      status === 'ongoing' || status === 'finished'
        ? this.parseScore(normalized[SHEET_COLUMNS.scoreB])
        : null;

    return new Match(id, date, teamA, teamB, status, scoreA, scoreB);
  }

  private parseDate(value: string | undefined): Date {
    if (!value) return new Date();

    // Numeric serial (Google Sheets/Excel) -> convert to JS Date
    const asNumber = Number(value);
    if (!isNaN(asNumber) && value.trim() !== '') {
      // Google Sheets serial epoch starts at 1899-12-30
      const ms = (asNumber - 25569) * 86400 * 1000;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) return d;
    }

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

    // Format type "dd/MM/yyyy HH:mm[:ss]"
    const fullMatch = value.match(
      /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/,
    );
    if (fullMatch) {
      const day = parseInt(fullMatch[1], 10);
      const month = parseInt(fullMatch[2], 10) - 1; // zero-based
      const year = parseInt(
        fullMatch[3].length === 2 ? `20${fullMatch[3]}` : fullMatch[3],
        10,
      );
      const hours = parseInt(fullMatch[4], 10);
      const minutes = parseInt(fullMatch[5], 10);
      const seconds = fullMatch[6] ? parseInt(fullMatch[6], 10) : 0;
      const d = new Date(year, month, day, hours, minutes, seconds);
      if (!isNaN(d.getTime())) return d;
    }

    const d = new Date(value);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  private parseScore(value: string | undefined): number | null {
    if (value === undefined) return null;
    const n = Number(String(value).replace(',', '.').trim());
    return isNaN(n) ? null : n;
  }

  private statusToSheet(status: MatchStatus): string {
    switch (status) {
      case 'ongoing':
        return 'c';
      case 'finished':
        return 'x';
      case 'planned':
      case 'deleted':
      default:
        return '';
    }
  }

  private sheetToStatus(value: string): MatchStatus {
    const normalized = (value ?? '').trim().toLowerCase();
    if (normalized === 'c') return 'ongoing';
    if (normalized === 'x') return 'finished';
    return 'planned';
  }

  private normalizePrivateKey(rawKey: string, b64Key: string): string {
    if (b64Key) {
      try {
        const decoded = Buffer.from(b64Key, 'base64').toString('utf8');
        return decoded.replace(/\r/g, '').replace(/^"+|"+$/g, '');
      } catch {
        // fall through to rawKey
      }
    }

    return rawKey
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/^"+|"+$/g, '');
  }

  private parseRange(range: string): {
    sheetName: string;
    startColumn: string;
    endColumn: string;
    startRow: number;
  } {
    const [sheetName, coords] = range.split('!');
    const match = coords?.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/i);
    if (!match) {
      return {
        sheetName: sheetName ?? 'Sheet1',
        startColumn: 'A',
        endColumn: 'E',
        startRow: 1,
      };
    }
    return {
      sheetName: sheetName ?? 'Sheet1',
      startColumn: match[1].toUpperCase(),
      startRow: parseInt(match[2], 10),
      endColumn: match[3].toUpperCase(),
    };
  }

  private getRowRange(rowNumber: number): string {
    const sheetName = this.range.split('!')[0];
    return `${sheetName}!${this.startColumn}${rowNumber}:${this.endColumn}${rowNumber}`;
  }

  private normalizeTeamKey(name: string): string {
    return name.trim().toLowerCase();
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

  private normalizeDriveUrl(url: string): string {
    const match = url.match(/\/file\/d\/([^/]+)\//);
    if (match && match[1]) {
      const id = match[1];
      return `https://drive.google.com/thumbnail?id=${id}&sz=w600`;
    }
    return url;
  }
}
