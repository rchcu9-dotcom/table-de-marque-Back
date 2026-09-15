import { Injectable, NotFoundException } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { DossierAccessService } from './dossier-access.service';

@Injectable()
export class SupprimerCoachUseCase {
  constructor(
    private readonly prisma: InscriptionPrismaService,
    private readonly dossierAccess: DossierAccessService,
  ) {}

  async execute(providerUid: string, coachId: number): Promise<void> {
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

    await this.prisma.inscCoachDossier.delete({ where: { id: coachId } });
  }
}
