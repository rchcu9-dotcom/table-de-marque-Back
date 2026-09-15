import { Inject, Injectable } from '@nestjs/common';
import { PlanningMatchSlot } from '../../domain/entities/planning-match-slot.entity';
import {
  PLANNING_MATCH_SLOT_REPOSITORY,
  PlanningMatchSlotRepository,
} from '../../domain/repositories/planning-match-slot.repository';

@Injectable()
export class GetPlaceholdersUseCase {
  constructor(
    @Inject(PLANNING_MATCH_SLOT_REPOSITORY)
    private readonly slotRepo: PlanningMatchSlotRepository,
  ) {}

  async execute(editionId: number): Promise<PlanningMatchSlot[]> {
    return this.slotRepo.findAllByEdition(editionId);
  }
}
