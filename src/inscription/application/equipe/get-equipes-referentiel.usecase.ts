import { Injectable } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { EquipeReferentiel } from '../../domain/entities/equipe-referentiel.entity';
import { toEquipeReferentielEntity } from '../../infrastructure/persistence/equipe-referentiel.mapper';

@Injectable()
export class GetEquipesReferentielUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async execute(toutesLesEquipes = false): Promise<EquipeReferentiel[]> {
    const where = toutesLesEquipes ? {} : { active: true };
    const equipes = await this.prisma.inscEquipeReferentiel.findMany({
      where,
      orderBy: { nom: 'asc' },
    });
    return equipes.map(toEquipeReferentielEntity);
  }
}
