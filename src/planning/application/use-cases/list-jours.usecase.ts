import { Inject, Injectable } from '@nestjs/common';
import {
  InscriptionEditionJourRepository,
  INSCRIPTION_EDITION_JOUR_REPOSITORY,
} from '../../domain/repositories/inscription-edition-jour.repository';
import { InscEditionJour } from '../../domain/entities/inscription-edition-jour.entity';

@Injectable()
export class ListJoursUseCase {
  constructor(
    @Inject(INSCRIPTION_EDITION_JOUR_REPOSITORY)
    private readonly repository: InscriptionEditionJourRepository,
  ) {}

  execute(editionId: number): Promise<InscEditionJour[]> {
    return this.repository.findByEdition(editionId);
  }
}
