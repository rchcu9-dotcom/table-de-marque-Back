import { Injectable, NotFoundException } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { Edition } from '../../domain/entities/edition.entity';
import { toEditionEntity } from '../../infrastructure/persistence/edition.mapper';
import { UpdateEditionDto } from './dto/update-edition.dto';

export { UpdateEditionDto };

@Injectable()
export class UpdateEditionUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(id: number, dto: UpdateEditionDto): Promise<Edition> {
    const existing = await this.prisma.inscEdition.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Édition ${id} introuvable`);
    }

    const updated = await this.prisma.inscEdition.update({
      where: { id },
      data: dto,
    });

    return toEditionEntity(updated);
  }
}
