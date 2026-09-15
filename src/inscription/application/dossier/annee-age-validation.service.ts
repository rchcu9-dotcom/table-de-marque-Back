import { BadRequestException, Injectable } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';

@Injectable()
export class AnneeAgeValidationService {
  constructor(private readonly prisma: InscriptionPrismaService) {}

  async assertAnneeAgeValide(editionId: number, annee: number): Promise<void> {
    const existe = await this.prisma.inscEditionAnneeAge.findUnique({
      where: { editionId_annee: { editionId, annee } },
    });
    if (!existe) {
      throw new BadRequestException(
        `Année d'âge ${annee} non configurée pour cette édition.`,
      );
    }
  }
}
