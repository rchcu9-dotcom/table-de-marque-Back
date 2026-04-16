import { Injectable, NotFoundException } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { EquipeReferentiel } from '../../domain/entities/equipe-referentiel.entity';
import { toEquipeReferentielEntity } from '../../infrastructure/persistence/equipe-referentiel.mapper';

@Injectable()
export class ValidateEquipeReferentielUseCase {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async activate(id: number): Promise<EquipeReferentiel> {
    return this.setActive(id, true);
  }

  async deactivate(id: number): Promise<EquipeReferentiel> {
    return this.setActive(id, false);
  }

  private async setActive(
    id: number,
    active: boolean,
  ): Promise<EquipeReferentiel> {
    const existing = await this.prisma.inscEquipeReferentiel.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Équipe référentiel ${id} introuvable`);
    }

    const updated = await this.prisma.inscEquipeReferentiel.update({
      where: { id },
      data: { active },
    });

    return toEquipeReferentielEntity(updated);
  }
}
