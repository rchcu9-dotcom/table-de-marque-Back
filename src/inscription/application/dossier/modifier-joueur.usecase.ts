import { Injectable, NotFoundException } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { DossierAccessService } from './dossier-access.service';
import { AnneeAgeValidationService } from './annee-age-validation.service';
import { UpdateJoueurDossierDto } from './dto/upsert-joueur-dossier.dto';
import { toJoueurDossierEntity } from '../../infrastructure/persistence/dossier.mapper';
import { JoueurDossier } from '../../domain/entities/joueur-dossier.entity';

@Injectable()
export class ModifierJoueurUseCase {
  constructor(
    private readonly prisma: InscriptionPrismaService,
    private readonly dossierAccess: DossierAccessService,
    private readonly anneeAgeValidation: AnneeAgeValidationService,
  ) {}

  async execute(
    providerUid: string,
    joueurId: number,
    dto: UpdateJoueurDossierDto,
  ): Promise<JoueurDossier> {
    const inscription =
      await this.dossierAccess.getInscriptionActivePourUtilisateur(providerUid);
    await this.dossierAccess.assertDossierModifiable(inscription);
    if (dto.anneeNaissance !== undefined) {
      await this.anneeAgeValidation.assertAnneeAgeValide(
        inscription.editionId,
        dto.anneeNaissance,
      );
    }

    const joueur = await this.prisma.inscJoueurDossier.findUnique({
      where: { id: joueurId },
      include: { dossier: true },
    });
    if (!joueur || joueur.dossier.inscriptionId !== inscription.id) {
      throw new NotFoundException('Joueur non trouvé');
    }

    const updated = await this.prisma.inscJoueurDossier.update({
      where: { id: joueurId },
      data: {
        nom: dto.nom,
        prenom: dto.prenom,
        numero: dto.numero,
        poste: dto.poste,
        licenceFFH: dto.licenceFFH,
        anneeNaissance: dto.anneeNaissance,
        particularitesAlim: dto.particularitesAlim,
      },
    });

    return toJoueurDossierEntity(updated);
  }
}
