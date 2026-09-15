import { Inject, Injectable } from '@nestjs/common';
import {
  InscriptionEditionJourRepository,
  INSCRIPTION_EDITION_JOUR_REPOSITORY,
} from '../../domain/repositories/inscription-edition-jour.repository';
import { InscEditionJour } from '../../domain/entities/inscription-edition-jour.entity';
import { UpsertJourDto } from '../dto/upsert-jour.dto';

@Injectable()
export class UpsertJourUseCase {
  constructor(
    @Inject(INSCRIPTION_EDITION_JOUR_REPOSITORY)
    private readonly repository: InscriptionEditionJourRepository,
  ) {}

  execute(editionId: number, dto: UpsertJourDto): Promise<InscEditionJour> {
    return this.repository.upsert(editionId, dto.numeroJour, {
      date: dto.date,
      heureDebut: dto.heureDebut,
      heureFin: dto.heureFin,
      typeJournee: dto.typeJournee,
    });
  }
}
