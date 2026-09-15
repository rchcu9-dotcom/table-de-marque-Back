import { Injectable } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { DossierAccessService } from './dossier-access.service';
import { AnneeAgeValidationService } from './annee-age-validation.service';
import { CreateJoueurDossierDto } from './dto/upsert-joueur-dossier.dto';
import { toJoueurDossierEntity } from '../../infrastructure/persistence/dossier.mapper';
import { JoueurDossier } from '../../domain/entities/joueur-dossier.entity';

@Injectable()
export class AjouterJoueurUseCase {
  constructor(
    private readonly prisma: InscriptionPrismaService,
    private readonly dossierAccess: DossierAccessService,
    private readonly anneeAgeValidation: AnneeAgeValidationService,
  ) {}

  async execute(
    providerUid: string,
    dto: CreateJoueurDossierDto,
  ): Promise<JoueurDossier> {
    const inscription =
      await this.dossierAccess.getInscriptionActivePourUtilisateur(providerUid);
    await this.dossierAccess.assertDossierModifiable(inscription);
    await this.anneeAgeValidation.assertAnneeAgeValide(
      inscription.editionId,
      dto.anneeNaissance,
    );

    const dossierId =
      await this.dossierAccess.assurerDossierEnCours(inscription);

    const joueur = await this.prisma.inscJoueurDossier.create({
      data: {
        dossierId,
        nom: dto.nom,
        prenom: dto.prenom,
        numero: dto.numero,
        poste: dto.poste,
        licenceFFH: dto.licenceFFH ?? null,
        anneeNaissance: dto.anneeNaissance ?? null,
        particularitesAlim: dto.particularitesAlim ?? null,
      },
    });

    return toJoueurDossierEntity(joueur);
  }
}
