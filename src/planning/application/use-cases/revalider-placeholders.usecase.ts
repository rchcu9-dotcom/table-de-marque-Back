import { Injectable } from '@nestjs/common';
import {
  PlanningPlaceholderResolverService,
  ResolutionResult,
} from '../services/planning-placeholder-resolver.service';

@Injectable()
export class RevaliderPlaceholdersUseCase {
  constructor(private readonly resolver: PlanningPlaceholderResolverService) {}

  async execute(editionId: number): Promise<ResolutionResult[]> {
    return this.resolver.revaliderToutesLesPoules(editionId);
  }
}
