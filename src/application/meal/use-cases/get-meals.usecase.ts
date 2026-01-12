import { Inject, Injectable } from '@nestjs/common';
import {
  MEAL_REPOSITORY,
  MealRepository,
} from '@/domain/meal/repositories/meal.repository';
import {
  MATCH_REPOSITORY,
  MatchRepository,
} from '@/domain/match/repositories/match.repository';
import { buildMealsPayload, MealsPayload } from '../meal.utils';

@Injectable()
export class GetMealsUseCase {
  constructor(
    @Inject(MEAL_REPOSITORY)
    private readonly mealRepo: MealRepository,
    @Inject(MATCH_REPOSITORY)
    private readonly matchRepo: MatchRepository,
  ) {}

  async execute(): Promise<MealsPayload> {
    const [source, matches] = await Promise.all([
      this.mealRepo.findMeals(),
      this.matchRepo.findAll(),
    ]);
    return buildMealsPayload(source, matches, new Date());
  }
}
