import { Injectable } from '@nestjs/common';
import {
  InscEditionJour,
  TypeJournee,
} from '../../domain/entities/inscription-edition-jour.entity';
import { InscriptionEditionJourRepository } from '../../domain/repositories/inscription-edition-jour.repository';
import { PlanningPrismaService } from './planning-prisma.service';

@Injectable()
export class PrismaInscriptionEditionJourRepository implements InscriptionEditionJourRepository {
  constructor(private readonly prisma: PlanningPrismaService) {}

  async findByEdition(editionId: number): Promise<InscEditionJour[]> {
    const rows = await this.prisma.inscEditionJour.findMany({
      where: { editionId },
      orderBy: { numeroJour: 'asc' },
    });
    return rows.map((row) => this.toEntity(row));
  }

  async upsert(
    editionId: number,
    numeroJour: number,
    data: { date: Date; heureDebut: Date; heureFin: Date; typeJournee: string },
  ): Promise<InscEditionJour> {
    const row = await this.prisma.inscEditionJour.upsert({
      where: { editionId_numeroJour: { editionId, numeroJour } },
      create: { editionId, numeroJour, ...data },
      update: data,
    });
    return this.toEntity(row);
  }

  async delete(editionId: number, numeroJour: number): Promise<void> {
    await this.prisma.inscEditionJour.deleteMany({
      where: { editionId, numeroJour },
    });
  }

  private toEntity(row: {
    id: number;
    editionId: number;
    numeroJour: number;
    date: Date;
    heureDebut: Date;
    heureFin: Date;
    typeJournee: string;
  }): InscEditionJour {
    return new InscEditionJour(
      row.id,
      row.editionId,
      row.numeroJour,
      row.date,
      row.heureDebut,
      row.heureFin,
      row.typeJournee as TypeJournee,
    );
  }
}
