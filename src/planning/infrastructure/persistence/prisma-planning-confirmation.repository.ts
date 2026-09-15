import { Injectable } from '@nestjs/common';
import { PlanningConfirmationRepository } from '../../domain/repositories/planning-confirmation.repository';
import { PlanningPrismaService } from './planning-prisma.service';

@Injectable()
export class PrismaPlanningConfirmationRepository implements PlanningConfirmationRepository {
  constructor(private readonly prisma: PlanningPrismaService) {}

  async record(data: {
    editionId: number;
    nbMatchsCrees: number;
    nbActivitesCrees: number;
    forcageEquipesFictives: boolean;
  }): Promise<void> {
    await this.prisma.planningConfirmation.create({ data });
  }
}
