import { Injectable } from '@nestjs/common';
import {
  MealRepository,
  MealSource,
} from '@/domain/meal/repositories/meal.repository';
import { PrismaService } from './prisma.service';

type MealRow = {
  repasSamedi: Date | null;
  repasDimanche: Date | null;
};

@Injectable()
export class MySqlMealRepository implements MealRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMeals(): Promise<MealSource> {
    const rows = await this.prisma.$queryRaw<MealRow[]>`
      SELECT
        MIN(REPAS_SAMEDI) as repasSamedi,
        MIN(REPAS_DIMANCHE) as repasDimanche
      FROM ta_equipes
    `;
    const row = rows[0];
    return {
      repasSamedi: row?.repasSamedi ?? null,
      repasDimanche: row?.repasDimanche ?? null,
    };
  }
}
