import { Injectable } from '@nestjs/common';
import { Edition } from '../../domain/entities/edition.entity';
import { toEditionEntity } from '../../infrastructure/persistence/edition.mapper';
import { EditionResolverService } from '../shared/edition-resolver.service';

/**
 * Admin-only (spec cycle annuel de l'édition §3) : édition en cours de
 * préparation pour la saison suivante, ou `null` tant qu'aucun cycle de
 * renouvellement n'a été démarré.
 */
@Injectable()
export class GetEditionEnPreparationUseCase {
  constructor(private readonly editionResolver: EditionResolverService) {}

  async execute(): Promise<Edition | null> {
    const edition = await this.editionResolver.getEditionEnPreparation();
    return edition ? toEditionEntity(edition) : null;
  }
}
