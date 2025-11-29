import { Injectable } from '@nestjs/common';
import { google, sheets_v4 } from 'googleapis';
import { v4 as uuid } from 'uuid';
import * as fs from 'node:fs';

import { Match } from '@/domain/match/entities/match.entity';
import { MatchRepository } from '@/domain/match/repositories/match.repository';

type MatchStatus = Match['status'];

// Columns within the selected range (B..L)
const SHEET_COLUMNS = {
  date: 0, // B
  status: 4, // F
  teamA: 5, // G
  teamB: 8, // J
  id: 10, // L
  width: 11, // B -> L inclusive
};

@Injectable()
export class GoogleSheetsMatchRepository implements MatchRepository {
  private readonly sheets: sheets_v4.Sheets;
  private readonly spreadsheetId: string;
  private readonly range: string;
  private readonly startRow: number;
  private readonly startColumn: string;
  private readonly endColumn: string;

  constructor() {
    const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    let clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
    let privateKey = '';

    if (keyFile) {
      const raw = fs.readFileSync(keyFile, 'utf8');
      const json = JSON.parse(raw);
      clientEmail = json.client_email;
      privateKey = this.normalizePrivateKey(json.private_key ?? '', '');
    } else {
      const rawKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY ?? '';
      const b64Key = process.env.GOOGLE_SHEETS_PRIVATE_KEY_BASE64 ?? '';
      privateKey = this.normalizePrivateKey(rawKey, b64Key);
    }
    this.spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? '';
    this.range = process.env.GOOGLE_SHEETS_RANGE ?? 'Matchs!B2:L32';
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

    const rows = response.data.values ?? [];
    return rows
      .map((row, index) => this.mapRow(row as string[], index))
      .filter((match): match is Match => !!match);
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

    const status = this.sheetToStatus(statusRaw);

    return new Match(
      id,
      dateRaw ? new Date(dateRaw) : new Date(),
      teamA,
      teamB,
      status,
    );
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
      return { sheetName: sheetName ?? 'Sheet1', startColumn: 'A', endColumn: 'E', startRow: 1 };
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
}
