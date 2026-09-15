import { Injectable } from '@nestjs/common';
import { ActiviteCatalogue } from '../../domain/entities/activite-catalogue.entity';
import {
  ActiviteCatalogueData,
  ActiviteCatalogueRepository,
} from '../../domain/repositories/activite-catalogue.repository';
import { PlanningPrismaService } from './planning-prisma.service';

@Injectable()
export class PrismaActiviteCatalogueRepository implements ActiviteCatalogueRepository {
  constructor(private readonly prisma: PlanningPrismaService) {}

  async findByEdition(editionId: number): Promise<ActiviteCatalogue[]> {
    const rows = await this.prisma.activiteCatalogue.findMany({
      where: { editionId },
      orderBy: { id: 'asc' },
    });
    return rows.map((row) => this.toEntity(row));
  }

  async create(
    editionId: number,
    data: ActiviteCatalogueData,
  ): Promise<ActiviteCatalogue> {
    const row = await this.prisma.activiteCatalogue.create({
      data: {
        editionId,
        label: data.label,
        dureeParEquipeMin: data.dureeParEquipeMin,
        capaciteParallele: data.capaciteParallele,
      },
    });
    return this.toEntity(row);
  }

  async update(
    id: number,
    editionId: number,
    data: ActiviteCatalogueData,
  ): Promise<ActiviteCatalogue> {
    const row = await this.prisma.activiteCatalogue.update({
      where: { id },
      data: {
        editionId,
        label: data.label,
        dureeParEquipeMin: data.dureeParEquipeMin,
        capaciteParallele: data.capaciteParallele,
      },
    });
    return this.toEntity(row);
  }

  async delete(id: number): Promise<void> {
    // Cascade côté DB (onDelete: Cascade sur CreneauActivite.activiteId) :
    // supprime aussi les créneaux de cette activité, sans confirmation (§2.2).
    await this.prisma.activiteCatalogue.delete({ where: { id } });
  }

  private toEntity(row: {
    id: number;
    editionId: number;
    label: string;
    dureeParEquipeMin: number;
    capaciteParallele: number;
    createdAt: Date;
  }): ActiviteCatalogue {
    return new ActiviteCatalogue(
      row.id,
      row.editionId,
      row.label,
      row.dureeParEquipeMin,
      row.capaciteParallele,
      row.createdAt,
    );
  }
}
