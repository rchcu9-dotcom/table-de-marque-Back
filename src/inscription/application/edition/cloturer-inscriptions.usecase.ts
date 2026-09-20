import { Injectable } from '@nestjs/common';
import { Edition } from '../../domain/entities/edition.entity';
import { ChangerEtapeEditionService } from './changer-etape-edition.service';

@Injectable()
export class CloturerInscriptionsUseCase {
  constructor(private readonly changerEtape: ChangerEtapeEditionService) {}

  execute(id: number): Promise<Edition> {
    return this.changerEtape.execute(id, 'CLOTUREE');
  }
}
