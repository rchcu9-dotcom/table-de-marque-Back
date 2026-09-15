import { Injectable } from '@nestjs/common';
import {
  DeplacerDirection,
  PresentationArticleData,
  PresentationArticleRecord,
  PresentationArticleRepository,
  PresentationGroupeMetaUpdate,
} from '@/domain/presentation/repositories/presentation-article.repository';
import { PrismaService } from './prisma.service';

type PresentationArticleRow = {
  id: number;
  groupe: string;
  groupeEn: string;
  titre: string;
  titreEn: string;
  description: string;
  descriptionEn: string;
  imageUrl: string | null;
  lienUrl: string | null;
  lieu: string | null;
  mapsQuery: string | null;
  ordre: number;
  groupeOrdre: number;
  groupeDureeMs: number;
  groupeImageUrl: string | null;
  surtitre: string;
  surtitreEn: string;
  faits: string | null;
  faitsEn: string | null;
  titreAccroche: string;
  titreAccrocheEn: string;
  descriptionCourte: string;
  descriptionCourteEn: string;
};

@Injectable()
export class MySqlPresentationArticleRepository implements PresentationArticleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllOrdered(): Promise<PresentationArticleRecord[]> {
    const rows = await this.prisma.presentationArticle.findMany({
      orderBy: [{ ordre: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.toEntity(row));
  }

  async create(
    data: PresentationArticleData,
  ): Promise<PresentationArticleRecord> {
    const row = await this.prisma.presentationArticle.create({ data });
    return this.toEntity(row);
  }

  async update(
    id: number,
    data: PresentationArticleData,
  ): Promise<PresentationArticleRecord> {
    const row = await this.prisma.presentationArticle.update({
      where: { id },
      data,
    });
    return this.toEntity(row);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.presentationArticle.delete({ where: { id } });
  }

  async updateGroupeMeta(
    groupe: string,
    data: PresentationGroupeMetaUpdate,
  ): Promise<void> {
    await this.prisma.presentationArticle.updateMany({
      where: { groupe },
      data: {
        ...(data.nom !== undefined ? { groupe: data.nom } : {}),
        ...(data.nomEn !== undefined ? { groupeEn: data.nomEn } : {}),
        ...(data.dureeMs !== undefined ? { groupeDureeMs: data.dureeMs } : {}),
        ...(data.imageUrl !== undefined
          ? { groupeImageUrl: data.imageUrl }
          : {}),
      },
    });
  }

  async deplacerGroupe(
    groupe: string,
    direction: DeplacerDirection,
  ): Promise<void> {
    const rows = await this.prisma.presentationArticle.findMany({
      select: { groupe: true, groupeOrdre: true },
      distinct: ['groupe'],
      orderBy: { groupeOrdre: 'asc' },
    });

    const index = rows.findIndex((r) => r.groupe === groupe);
    if (index < 0) return;

    const neighborIndex = direction === 'haut' ? index - 1 : index + 1;
    const neighbor = rows[neighborIndex];
    if (!neighbor) return;

    const current = rows[index];
    await this.prisma.$transaction([
      this.prisma.presentationArticle.updateMany({
        where: { groupe: current.groupe },
        data: { groupeOrdre: neighbor.groupeOrdre },
      }),
      this.prisma.presentationArticle.updateMany({
        where: { groupe: neighbor.groupe },
        data: { groupeOrdre: current.groupeOrdre },
      }),
    ]);
  }

  async deplacerArticle(
    id: number,
    direction: DeplacerDirection,
  ): Promise<void> {
    const article = await this.prisma.presentationArticle.findUnique({
      where: { id },
      select: { id: true, groupe: true, ordre: true },
    });
    if (!article) return;

    const siblings = await this.prisma.presentationArticle.findMany({
      where: { groupe: article.groupe },
      select: { id: true, ordre: true },
      orderBy: { ordre: 'asc' },
    });

    const index = siblings.findIndex((s) => s.id === article.id);
    const neighborIndex = direction === 'haut' ? index - 1 : index + 1;
    const neighbor = siblings[neighborIndex];
    if (!neighbor) return;

    await this.prisma.$transaction([
      this.prisma.presentationArticle.update({
        where: { id: article.id },
        data: { ordre: neighbor.ordre },
      }),
      this.prisma.presentationArticle.update({
        where: { id: neighbor.id },
        data: { ordre: article.ordre },
      }),
    ]);
  }

  async deleteGroupe(groupe: string): Promise<void> {
    await this.prisma.presentationArticle.deleteMany({ where: { groupe } });
  }

  private toEntity(row: PresentationArticleRow): PresentationArticleRecord {
    return new PresentationArticleRecord(
      row.id,
      row.groupe,
      row.groupeEn,
      row.titre,
      row.titreEn,
      row.description,
      row.descriptionEn,
      row.imageUrl,
      row.lienUrl,
      row.lieu,
      row.mapsQuery,
      row.ordre,
      row.groupeOrdre,
      row.groupeDureeMs,
      row.groupeImageUrl,
      row.surtitre,
      row.surtitreEn,
      row.faits ?? '',
      row.faitsEn ?? '',
      row.titreAccroche,
      row.titreAccrocheEn,
      row.descriptionCourte,
      row.descriptionCourteEn,
    );
  }
}
