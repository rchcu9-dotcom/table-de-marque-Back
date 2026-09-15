import { Inject, Injectable } from '@nestjs/common';
import {
  CreneauActiviteRepository,
  CRENEAU_ACTIVITE_REPOSITORY,
} from '../../../domain/repositories/creneau-activite.repository';

@Injectable()
export class SupprimerCreneauActiviteUseCase {
  constructor(
    @Inject(CRENEAU_ACTIVITE_REPOSITORY)
    private readonly repository: CreneauActiviteRepository,
  ) {}

  execute(id: number, editionId: number): Promise<void> {
    return this.repository.delete(id, editionId);
  }
}
