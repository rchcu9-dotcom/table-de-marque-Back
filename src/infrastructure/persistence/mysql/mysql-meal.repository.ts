import { Injectable } from '@nestjs/common';
import {
  MealRepository,
  MealSource,
} from '@/domain/meal/repositories/meal.repository';
import { PrismaService } from './prisma.service';
import { parseParisSqlDateTime } from './date-paris.utils';

type MealRow = {
  repasSamediSql: string | null;
  repasDimancheSql: string | null;
};

@Injectable()
export class MySqlMealRepository implements MealRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMeals(): Promise<MealSource> {
    const rows = await this.prisma.$queryRaw<MealRow[]>`
      SELECT
        DATE_FORMAT(MIN(REPAS_SAMEDI), '%Y-%m-%d %H:%i:%s') as repasSamediSql,
        DATE_FORMAT(MIN(REPAS_DIMANCHE), '%Y-%m-%d %H:%i:%s') as repasDimancheSql
      FROM ta_equipes
    `;
    const row = rows[0];
    return {
      repasSamedi: parseParisSqlDateTime(row?.repasSamediSql ?? null),
      repasDimanche: parseParisSqlDateTime(row?.repasDimancheSql ?? null),
    };
  }
}
