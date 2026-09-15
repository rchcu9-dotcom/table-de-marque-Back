import { Inject, Injectable } from '@nestjs/common';
import {
  InscriptionEditionJourRepository,
  INSCRIPTION_EDITION_JOUR_REPOSITORY,
} from '../../domain/repositories/inscription-edition-jour.repository';

@Injectable()
export class DeleteJourUseCase {
  constructor(
    @Inject(INSCRIPTION_EDITION_JOUR_REPOSITORY)
    private readonly repository: InscriptionEditionJourRepository,
  ) {}

  execute(editionId: number, numeroJour: number): Promise<void> {
    return this.repository.delete(editionId, numeroJour);
  }
}
