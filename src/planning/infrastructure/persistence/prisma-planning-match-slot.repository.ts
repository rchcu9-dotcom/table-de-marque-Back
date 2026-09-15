import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PlacementCote,
  PlanningMatchSlot,
  PlanningMatchSlotDraft,
} from '../../domain/entities/planning-match-slot.entity';
import { PlanningMatchSlotRepository } from '../../domain/repositories/planning-match-slot.repository';
import { PlanningPrismaService } from './planning-prisma.service';

type PlanningMatchSlotRow = {
  id: number;
  editionId: number;
  numMatch: number;
  cote: number;
  ref: string;
  libellePlaceholder: string;
  numMatchSource: number | null;
  pouleCode: string | null;
  rangPoule: number | null;
  resolu: boolean;
  equipeIdResolu: number | null;
  equipeNomResolu: string | null;
  resoluAt: Date | null;
  resoluManuellement: boolean;
};

@Injectable()
export class PrismaPlanningMatchSlotRepository implements PlanningMatchSlotRepository {
  constructor(private readonly prisma: PlanningPrismaService) {}

  async createMany(slots: PlanningMatchSlotDraft[]): Promise<void> {
    for (const slot of slots) {
      await this.prisma.planningMatchSlot.upsert({
        where: {
          numMatch_cote: { numMatch: slot.numMatch, cote: slot.cote },
        },
        update: {},
        create: {
          editionId: slot.editionId,
          numMatch: slot.numMatch,
          cote: slot.cote,
          ref: slot.ref,
          libellePlaceholder: slot.libellePlaceholder,
          numMatchSource: slot.numMatchSource,
          pouleCode: slot.pouleCode,
          rangPoule: slot.rangPoule,
        },
      });
    }
  }

  async findAllByEdition(editionId: number): Promise<PlanningMatchSlot[]> {
    const rows = await this.prisma.planningMatchSlot.findMany({
      where: { editionId },
      orderBy: [{ numMatch: 'asc' }, { cote: 'asc' }],
    });
    return rows.map((row) => this.toEntity(row));
  }

  async findNonResolusParPoule(
    editionId: number,
    pouleCode: string,
  ): Promise<PlanningMatchSlot[]> {
    const rows = await this.prisma.planningMatchSlot.findMany({
      where: { editionId, pouleCode, resolu: false },
    });
    return rows.map((row) => this.toEntity(row));
  }

  async findByNumMatchSource(
    numMatchSource: number,
  ): Promise<PlanningMatchSlot[]> {
    const rows = await this.prisma.planningMatchSlot.findMany({
      where: { numMatchSource, resolu: false },
    });
    return rows.map((row) => this.toEntity(row));
  }

  async findById(id: number): Promise<PlanningMatchSlot | null> {
    const row = await this.prisma.planningMatchSlot.findUnique({
      where: { id },
    });
    return row ? this.toEntity(row) : null;
  }

  async marquerResolu(
    id: number,
    equipeIdResolu: number,
    equipeNomResolu: string,
    resoluManuellement: boolean,
  ): Promise<PlanningMatchSlot> {
    const existing = await this.prisma.planningMatchSlot.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`PlanningMatchSlot ${id} introuvable`);
    }
    const row = await this.prisma.planningMatchSlot.update({
      where: { id },
      data: {
        resolu: true,
        equipeIdResolu,
        equipeNomResolu,
        resoluAt: new Date(),
        resoluManuellement,
      },
    });
    return this.toEntity(row);
  }

  private toEntity(row: PlanningMatchSlotRow): PlanningMatchSlot {
    return new PlanningMatchSlot(
      row.id,
      row.editionId,
      row.numMatch,
      row.cote as PlacementCote,
      row.ref,
      row.libellePlaceholder,
      row.numMatchSource,
      row.pouleCode,
      row.rangPoule,
      row.resolu,
      row.equipeIdResolu,
      row.equipeNomResolu,
      row.resoluAt,
      row.resoluManuellement,
    );
  }
}
