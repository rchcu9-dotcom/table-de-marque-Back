export type MealSource = {
  repasSamedi: Date | null;
  repasDimanche: Date | null;
};

export const MEAL_REPOSITORY = Symbol('MEAL_REPOSITORY');

export abstract class MealRepository {
  abstract findMeals(): Promise<MealSource>;
}
