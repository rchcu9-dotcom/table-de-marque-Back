import { Injectable } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { EquipeReferentiel } from '../../domain/entities/equipe-referentiel.entity';
import { toEquipeReferentielEntity } from '../../infrastructure/persistence/equipe-referentiel.mapper';
import { CreateEquipeReferentielDto } from './dto/create-equipe-referentiel.dto';

export { CreateEquipeReferentielDto };

@Injectable()
export class CreateEquipeReferentielUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(dto: CreateEquipeReferentielDto): Promise<EquipeReferentiel> {
    const equipe = await this.prisma.inscEquipeReferentiel.create({
      data: {
        nom: dto.nom,
        logoUrl: dto.logoUrl ?? null,
        active: false,
      },
    });
    return toEquipeReferentielEntity(equipe);
  }
}
