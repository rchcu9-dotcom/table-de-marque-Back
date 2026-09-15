import { Injectable } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { DossierAccessService } from './dossier-access.service';
import { AccepterDroitsImageDto } from './dto/accepter-droits-image.dto';
import { toDossierEntity } from '../../infrastructure/persistence/dossier.mapper';
import { Dossier } from '../../domain/entities/dossier.entity';

@Injectable()
export class AccepterDroitsImageUseCase {
  constructor(
    private readonly prisma: InscriptionPrismaService,
    private readonly dossierAccess: DossierAccessService,
  ) {}

  async execute(
    providerUid: string,
    dto: AccepterDroitsImageDto,
  ): Promise<Dossier> {
    const inscription =
      await this.dossierAccess.getInscriptionActivePourUtilisateur(providerUid);
    await this.dossierAccess.assertDossierModifiable(inscription);

    const dossierId =
      await this.dossierAccess.assurerDossierEnCours(inscription);

    const dossier = await this.prisma.inscDossier.update({
      where: { id: dossierId },
      data: {
        droitsImageAcceptes: dto.accepte,
        droitsImageHorodatage: dto.accepte ? new Date() : null,
      },
    });

    return toDossierEntity(dossier);
  }
}
