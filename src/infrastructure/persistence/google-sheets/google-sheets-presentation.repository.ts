import { Injectable, Logger } from '@nestjs/common';
import { PresentationRepository } from '@/domain/presentation/repositories/presentation.repository';
import {
  ArticlePresentation,
  PresentationGroupe,
} from '@/domain/presentation/entities/article-presentation.entity';
import { parseCsv } from './csv-parser.util';
import { normalizeDriveUrl } from './drive-url.util';

type ColumnKey =
  | 'groupe'
  | 'groupeEn'
  | 'titre'
  | 'titreEn'
  | 'description'
  | 'descriptionEn'
  | 'lieu'
  | 'mapsQuery'
  | 'image'
  | 'lien';

const COLUMN_ALIASES: Record<ColumnKey, string[]> = {
  groupe: ['titre'],
  groupeEn: ['titre en', 'titre_en'],
  titre: ['sous-titre', 'sous titre'],
  titreEn: ['sous-titre en', 'sous titre en'],
  description: ['description'],
  descriptionEn: ['description en'],
  lieu: ['lieu'],
  mapsQuery: ['maps'],
  image: ['image'],
  lien: ['lien'],
};

/**
 * Chaque alias est comparé par égalité exacte de cellule normalisée (pas de substring) :
 * "titre" et "titre en" ne se chevauchent donc jamais. `used` reste une garde
 * défensive au cas où un export réel introduirait un intitulé de colonne ambigu.
 */
const COLUMN_ORDER: ColumnKey[] = [
  'groupeEn',
  'titreEn',
  'descriptionEn',
  'groupe',
  'titre',
  'description',
  'lieu',
  'mapsQuery',
  'image',
  'lien',
];

// Le CSV n'a pas de colonne dédiée à la durée/l'image de chapitre : cette
// source reste le chemin legacy (MySQL est la source enrichie, cf.
// commentaire de MySqlPresentationRepository), on applique donc une durée
// par défaut identique à celle de la colonne Prisma `groupe_duree_ms`.
const DEFAULT_GROUP_DUREE_MS = 5000;

@Injectable()
export class GoogleSheetsPresentationRepository implements PresentationRepository {
  private readonly logger = new Logger(GoogleSheetsPresentationRepository.name);
  private readonly csvUrl: string;

  constructor() {
    const csvUrl = process.env.GOOGLE_SHEETS_PRESENTATION_CSV_URL;
    if (!csvUrl) {
      throw new Error(
        'Missing GOOGLE_SHEETS_PRESENTATION_CSV_URL for presentation repository.',
      );
    }
    this.csvUrl = csvUrl;
  }

  async findAll(): Promise<PresentationGroupe[]> {
    const url = this.withCacheBuster(this.csvUrl);
    this.logger.debug(`Fetching presentation CSV: ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch presentation CSV: ${res.status} ${res.statusText}`,
      );
    }
    const csv = await res.text();
    const rows = parseCsv(csv);
    if (rows.length <= 1) return [];

    const columnIndex = this.buildColumnIndex(rows[0]);
    const dataRows = rows.slice(1);

    const groupesByNom = new Map<
      string,
      { nomEn: string; articles: ArticlePresentation[] }
    >();

    let lastGroupe = '';
    let lastGroupeEn = '';

    for (const row of dataRows) {
      if (row.every((cell) => cell.trim() === '')) continue;

      const rawGroupe = this.cell(row, columnIndex.groupe).trim();
      const rawGroupeEn = this.cell(row, columnIndex.groupeEn).trim();

      // Le report de cellule vide (comportement de cellule fusionnée) ne s'applique
      // qu'au sein d'un même bloc : dès qu'une nouvelle valeur FR apparaît, on
      // réinitialise l'EN sur la valeur de CETTE ligne (même si vide) pour ne jamais
      // faire fuiter le libellé anglais du groupe précédent sur le nouveau groupe.
      if (rawGroupe) {
        lastGroupe = rawGroupe;
        lastGroupeEn = rawGroupeEn;
      } else if (rawGroupeEn) {
        lastGroupeEn = rawGroupeEn;
      }

      const groupeNom = lastGroupe;
      if (!groupeNom) continue;
      const groupeNomEn = lastGroupeEn || groupeNom;

      const titre = this.cell(row, columnIndex.titre).trim();
      const titreEn = this.cell(row, columnIndex.titreEn).trim();
      const description = this.cell(row, columnIndex.description).trim();
      const descriptionEn = this.cell(row, columnIndex.descriptionEn).trim();
      const image = this.cell(row, columnIndex.image).trim();
      const lien = this.cell(row, columnIndex.lien).trim();
      const lieu = this.cell(row, columnIndex.lieu).trim();
      const mapsQuery = this.cell(row, columnIndex.mapsQuery).trim();

      const article = new ArticlePresentation(
        groupeNom,
        groupeNomEn,
        titre,
        titreEn || titre,
        description,
        descriptionEn || description,
        image ? normalizeDriveUrl(image) : null,
        lien || null,
        lieu || null,
        mapsQuery || null,
      );

      let entry = groupesByNom.get(groupeNom);
      if (!entry) {
        entry = { nomEn: groupeNomEn, articles: [] };
        groupesByNom.set(groupeNom, entry);
      }
      entry.articles.push(article);
    }

    return Array.from(groupesByNom.entries()).map(
      ([nom, { nomEn, articles }], index) =>
        new PresentationGroupe(
          nom,
          nomEn,
          articles,
          index,
          DEFAULT_GROUP_DUREE_MS,
          articles[0]?.imageUrl ?? null,
        ),
    );
  }

  private buildColumnIndex(headerRow: string[]): Record<ColumnKey, number> {
    const normalized = headerRow.map((h) => h.trim().toLowerCase());
    const used = new Set<number>();
    const index = {} as Record<ColumnKey, number>;

    for (const key of COLUMN_ORDER) {
      const aliases = COLUMN_ALIASES[key];
      const found = normalized.findIndex(
        (h, i) => aliases.includes(h) && !used.has(i),
      );
      index[key] = found;
      if (found >= 0) used.add(found);
    }

    return index;
  }

  private cell(row: string[], index: number): string {
    if (index < 0) return '';
    return row[index] ?? '';
  }

  private withCacheBuster(url: string): string {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}cb=${Date.now()}`;
  }
}
