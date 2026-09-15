import { Injectable } from '@nestjs/common';
import { CreneauActivite } from '../../domain/entities/creneau-activite.entity';
import { CreneauActiviteStatut } from '../../domain/enums/creneau-activite-statut.enum';
import {
  CreneauActiviteData,
  CreneauActiviteRepository,
  CreneauAssignation,
} from '../../domain/repositories/creneau-activite.repository';
import { PlanningPrismaService } from './planning-prisma.service';

@Injectable()
export class PrismaCreneauActiviteRepository implements CreneauActiviteRepository {
  constructor(private readonly prisma: PlanningPrismaService) {}

  async findByEdition(editionId: number): Promise<CreneauActivite[]> {
    const rows = await this.prisma.creneauActivite.findMany({
      where: { editionId },
      orderBy: [{ heureDebut: 'asc' }],
    });
    return rows.map((row) => this.toEntity(row));
  }

  async findLibresByEdition(editionId: number): Promise<CreneauActivite[]> {
    const rows = await this.prisma.creneauActivite.findMany({
      where: { editionId, statut: 'LIBRE' },
      orderBy: [{ heureDebut: 'asc' }],
    });
    return rows.map((row) => this.toEntity(row));
  }

  async findConfirmesByEdition(editionId: number): Promise<CreneauActivite[]> {
    const rows = await this.prisma.creneauActivite.findMany({
      where: { editionId, statut: 'CONFIRME' },
      orderBy: [{ heureDebut: 'asc' }],
    });
    return rows.map((row) => this.toEntity(row));
  }

  async create(
    editionId: number,
    data: CreneauActiviteData,
  ): Promise<CreneauActivite> {
    const row = await this.prisma.creneauActivite.create({
      data: {
        editionId,
        activiteId: data.activiteId,
        date: data.date,
        heureDebut: data.heureDebut,
        dureeMin: data.dureeMin,
      },
    });
    return this.toEntity(row);
  }

  async update(
    id: number,
    editionId: number,
    data: CreneauActiviteData,
  ): Promise<CreneauActivite> {
    const row = await this.prisma.creneauActivite.update({
      where: { id },
      data: {
        editionId,
        activiteId: data.activiteId,
        date: data.date,
        heureDebut: data.heureDebut,
        dureeMin: data.dureeMin,
      },
    });
    return this.toEntity(row);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.creneauActivite.delete({ where: { id } });
  }

  async assignerEquipes(
    editionId: number,
    assignations: CreneauAssignation[],
  ): Promise<CreneauActivite[]> {
    const updated: CreneauActivite[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (const assignation of assignations) {
        const row = await tx.creneauActivite.update({
          where: { id: assignation.creneauId },
          data: {
            equipeId: assignation.equipeId,
            equipeLabel: assignation.equipeLabel,
            statut: 'CONFIRME',
          },
        });
        updated.push(this.toEntity(row));
      }
    });
    void editionId;
    return updated;
  }

  private toEntity(row: {
    id: number;
    editionId: number;
    activiteId: number;
    date: Date;
    heureDebut: Date;
    dureeMin: number;
    equipeId: number | null;
    equipeLabel: string | null;
    statut: string;
    createdAt: Date;
  }): CreneauActivite {
    return new CreneauActivite(
      row.id,
      row.editionId,
      row.activiteId,
      row.date,
      row.heureDebut,
      row.dureeMin,
      row.equipeId,
      row.equipeLabel,
      row.statut as CreneauActiviteStatut,
      row.createdAt,
    );
  }
}
