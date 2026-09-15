import { Injectable } from '@nestjs/common';
import { Edition } from '../../domain/entities/edition.entity';
import { toEditionEntity } from '../../infrastructure/persistence/edition.mapper';
import { EditionResolverService } from '../shared/edition-resolver.service';

@Injectable()
export class GetEditionCouranteUseCase {
  constructor(private readonly editionResolver: EditionResolverService) {}

  async execute(): Promise<Edition> {
    const edition = await this.editionResolver.getEditionActive();
    return toEditionEntity(edition);
  }
}
