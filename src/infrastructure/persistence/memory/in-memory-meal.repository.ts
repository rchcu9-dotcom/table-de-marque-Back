import { MealRepository, MealSource } from '@/domain/meal/repositories/meal.repository';

export class InMemoryMealRepository implements MealRepository {
  async findMeals(): Promise<MealSource> {
    return { repasSamedi: null, repasDimanche: null };
  }
}
