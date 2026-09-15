export const PLANNING_CONFIRMATION_REPOSITORY = Symbol(
  'PLANNING_CONFIRMATION_REPOSITORY',
);

export abstract class PlanningConfirmationRepository {
  abstract record(data: {
    editionId: number;
    nbMatchsCrees: number;
    nbActivitesCrees: number;
    forcageEquipesFictives: boolean;
  }): Promise<void>;
}
