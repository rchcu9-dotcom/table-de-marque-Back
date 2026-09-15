import { Injectable } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { DossierAccessService } from './dossier-access.service';
import { CreateCoachDossierDto } from './dto/upsert-coach-dossier.dto';
import { toCoachDossierEntity } from '../../infrastructure/persistence/dossier.mapper';
import { CoachDossier } from '../../domain/entities/coach-dossier.entity';

@Injectable()
export class AjouterCoachUseCase {
  constructor(
    private readonly prisma: InscriptionPrismaService,
    private readonly dossierAccess: DossierAccessService,
  ) {}

  async execute(
    providerUid: string,
    dto: CreateCoachDossierDto,
  ): Promise<CoachDossier> {
    const inscription =
      await this.dossierAccess.getInscriptionActivePourUtilisateur(providerUid);
    await this.dossierAccess.assertDossierModifiable(inscription);

    const dossierId =
      await this.dossierAccess.assurerDossierEnCours(inscription);

    const coach = await this.prisma.inscCoachDossier.create({
      data: {
        dossierId,
        nom: dto.nom,
        prenom: dto.prenom,
        presenceRepas: dto.presenceRepas ?? false,
      },
    });

    return toCoachDossierEntity(coach);
  }
}
