import { Injectable } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { EditionVerrouService } from '../shared/edition-verrou.service';
import { Edition } from '../../domain/entities/edition.entity';
import { toEditionEntity } from '../../infrastructure/persistence/edition.mapper';
import { UpdateEditionDto } from './dto/update-edition.dto';

export { UpdateEditionDto };

@Injectable()
export class UpdateEditionUseCase {
  constructor(
    private readonly prisma: InscriptionPrismaService,
    private readonly editionVerrou: EditionVerrouService,
  ) {}

  async execute(id: number, dto: UpdateEditionDto): Promise<Edition> {
    // Figés dès l'ouverture des inscriptions (404 si l'édition n'existe pas).
    await this.editionVerrou.assertParametresInscriptionModifiables(id);

    const updated = await this.prisma.inscEdition.update({
      where: { id },
      data: dto,
      include: { anneesAge: true },
    });

    return toEditionEntity(updated);
  }
}
