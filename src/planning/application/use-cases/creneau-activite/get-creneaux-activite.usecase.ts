import { Inject, Injectable } from '@nestjs/common';
import {
  CreneauActiviteRepository,
  CRENEAU_ACTIVITE_REPOSITORY,
} from '../../../domain/repositories/creneau-activite.repository';
import { CreneauActivite } from '../../../domain/entities/creneau-activite.entity';

@Injectable()
export class GetCreneauxActiviteUseCase {
  constructor(
    @Inject(CRENEAU_ACTIVITE_REPOSITORY)
    private readonly repository: CreneauActiviteRepository,
  ) {}

  execute(editionId: number): Promise<CreneauActivite[]> {
    return this.repository.findByEdition(editionId);
  }
}
