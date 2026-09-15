import { Inject, Injectable } from '@nestjs/common';
import {
  FORMAT_GRAPHE_REPOSITORY,
  FormatGrapheRepository,
} from '../../../domain/repositories/format-graphe.repository';

@Injectable()
export class SupprimerPlaceUseCase {
  constructor(
    @Inject(FORMAT_GRAPHE_REPOSITORY)
    private readonly repo: FormatGrapheRepository,
  ) {}

  async execute(editionId: number, placeId: number): Promise<void> {
    await this.repo.supprimerPlace(placeId);
    await this.repo.marquerModifieManuellement(editionId);
  }
}
