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
        DATE_FORMAT(
          MIN(CASE WHEN GROUPE_NOM IN ('A', 'B', 'C', 'D') THEN REPAS_SAMEDI END),
          '%Y-%m-%d %H:%i:%s'
        ) as repasSamediSql,
        DATE_FORMAT(
          MIN(CASE WHEN GROUPE_NOM IN ('E', 'F', 'G', 'H') THEN REPAS_DIMANCHE END),
          '%Y-%m-%d %H:%i:%s'
        ) as repasDimancheSql
      FROM ta_classement
    `;
    const row = rows[0];
    return {
      repasSamedi: parseParisSqlDateTime(row?.repasSamediSql ?? null),
      repasDimanche: parseParisSqlDateTime(row?.repasDimancheSql ?? null),
    };
  }
}
