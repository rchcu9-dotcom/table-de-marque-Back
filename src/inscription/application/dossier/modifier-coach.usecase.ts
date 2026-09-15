import { Injectable, NotFoundException } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { DossierAccessService } from './dossier-access.service';
import { UpdateCoachDossierDto } from './dto/upsert-coach-dossier.dto';
import { toCoachDossierEntity } from '../../infrastructure/persistence/dossier.mapper';
import { CoachDossier } from '../../domain/entities/coach-dossier.entity';

@Injectable()
export class ModifierCoachUseCase {
  constructor(
    private readonly prisma: InscriptionPrismaService,
    private readonly dossierAccess: DossierAccessService,
  ) {}

  async execute(
    providerUid: string,
    coachId: number,
    dto: UpdateCoachDossierDto,
  ): Promise<CoachDossier> {
    const inscription =
      await this.dossierAccess.getInscriptionActivePourUtilisateur(providerUid);
    await this.dossierAccess.assertDossierModifiable(inscription);

    const coach = await this.prisma.inscCoachDossier.findUnique({
      where: { id: coachId },
      include: { dossier: true },
    });
    if (!coach || coach.dossier.inscriptionId !== inscription.id) {
      throw new NotFoundException('Coach non trouvé');
    }

    const updated = await this.prisma.inscCoachDossier.update({
      where: { id: coachId },
      data: {
        nom: dto.nom,
        prenom: dto.prenom,
        presenceRepas: dto.presenceRepas,
      },
    });

    return toCoachDossierEntity(updated);
  }
}
