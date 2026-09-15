import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InscEdition } from '@prisma/client';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { Edition } from '../../domain/entities/edition.entity';
import { toEditionEntity } from '../../infrastructure/persistence/edition.mapper';
import { EditionResolverService } from '../shared/edition-resolver.service';
import { CreateEditionDto } from './dto/create-edition.dto';

export { CreateEditionDto };

@Injectable()
export class CreateEditionUseCase {
  constructor(
    private readonly prisma: InscriptionPrismaService,
    private readonly editionResolver: EditionResolverService,
  ) {}

  async execute(dto: CreateEditionDto): Promise<Edition> {
    let editionActive: InscEdition | null = null;
    if (dto.etape === 'CREATION_NOUVEAU_TOURNOI') {
      // Garde-fou double-clic (spec cycle annuel §7 point 3) : une seule
      // édition en préparation à la fois.
      const enPreparation =
        await this.editionResolver.getEditionEnPreparation();
      if (enPreparation) {
        throw new ConflictException('Une édition en préparation existe déjà.');
      }

      // Reprise des paramètres du parcours d'inscription de l'édition active
      // sortante (spec "tous les paramètres de parcours d'inscription par
      // défaut"), pour éviter à l'organisateur de tout ressaisir chaque
      // année. Catch volontairement étroit sur NotFoundException (premier
      // tournoi jamais créé, CA3) : toute autre erreur doit remonter, pas
      // être confondue avec "aucune édition existante".
      try {
        editionActive = await this.editionResolver.getEditionActive();
      } catch (e) {
        if (!(e instanceof NotFoundException)) throw e;
      }
    }

    // dateDebut/dateFinDebut/dateFinFin : le formulaire minimal du cycle
    // annuel (nom/catégorie/année, spec §5.2) ne les fournit pas — bootstrap
    // grossier au 1er janvier de `annee`, jamais repris de l'édition active
    // (CA4 : mauvaise année quasi certaine sinon), ajustées ensuite via
    // ParametresInscriptionPage avant l'ouverture des inscriptions (spec
    // §5.5, "à ses risques").
    const dateBootstrap = new Date(Date.UTC(dto.annee, 0, 1));

    // Decimal Prisma -> number, cohérent avec la conversion déjà faite dans
    // edition.mapper.ts (Number(raw.fraisInscription)).
    const fraisInscriptionActif = editionActive
      ? Number(editionActive.fraisInscription)
      : null;
    const prixRepasActif = editionActive
      ? Number(editionActive.prixRepas)
      : null;

    const edition = await this.prisma.inscEdition.create({
      data: {
        nom: dto.nom,
        categorie: dto.categorie,
        annee: dto.annee,
        etape: dto.etape ?? 'CREEE',
        dateDebut: dto.dateDebut ?? dateBootstrap,
        dateFinDebut: dto.dateFinDebut ?? dateBootstrap,
        dateFinFin: dto.dateFinFin ?? dateBootstrap,
        // Tarifs/quota, contact, images et messages du parcours
        // d'inscription : repris de l'édition active si non fournis
        // explicitement dans le dto (priorité dto > editionActive >
        // défaut actuel — CA1, CA2).
        fraisInscription: dto.fraisInscription ?? fraisInscriptionActif ?? 0,
        prixRepas: dto.prixRepas ?? prixRepasActif ?? 0,
        nbPlacesMax: dto.nbPlacesMax ?? editionActive?.nbPlacesMax ?? 16,
        imageUrl: dto.imageUrl ?? editionActive?.imageUrl ?? null,
        imageDossierUrl:
          dto.imageDossierUrl ?? editionActive?.imageDossierUrl ?? null,
        imageRibUrl: dto.imageRibUrl ?? editionActive?.imageRibUrl ?? null,
        contactEmail: dto.contactEmail ?? editionActive?.contactEmail ?? null,
        contactPhone: dto.contactPhone ?? editionActive?.contactPhone ?? null,
        // Paramètres sportifs : INCHANGÉS (CA5, hors périmètre "parcours
        // d'inscription", gérés par ParametresSportifsPage).
        dureeSurfacageMin: dto.dureeSurfacageMin ?? 20,
        dureeMatchPouleMin: dto.dureeMatchPouleMin ?? 27,
        dureeMatchFinalMin: dto.dureeMatchFinalMin ?? 33,
        affichagePlanningPublic: dto.affichagePlanningPublic ?? false,
        msgBienvenue: dto.msgBienvenue ?? editionActive?.msgBienvenue ?? null,
        msgFaisonsConnaissance:
          dto.msgFaisonsConnaissance ??
          editionActive?.msgFaisonsConnaissance ??
          null,
        msgSelectionEquipe:
          dto.msgSelectionEquipe ?? editionActive?.msgSelectionEquipe ?? null,
        msgAjoutEquipe:
          dto.msgAjoutEquipe ?? editionActive?.msgAjoutEquipe ?? null,
        msgInscriptionEnCours:
          dto.msgInscriptionEnCours ??
          editionActive?.msgInscriptionEnCours ??
          null,
        msgInscriptionValidee:
          dto.msgInscriptionValidee ??
          editionActive?.msgInscriptionValidee ??
          null,
        msgLancerDemande:
          dto.msgLancerDemande ?? editionActive?.msgLancerDemande ?? null,
        msgDemandeSoumise:
          dto.msgDemandeSoumise ?? editionActive?.msgDemandeSoumise ?? null,
        msgEquipeRefusee:
          dto.msgEquipeRefusee ?? editionActive?.msgEquipeRefusee ?? null,
        msgListeAttente:
          dto.msgListeAttente ?? editionActive?.msgListeAttente ?? null,
        msgPaiementAttendu:
          dto.msgPaiementAttendu ?? editionActive?.msgPaiementAttendu ?? null,
        msgChequeInfo1:
          dto.msgChequeInfo1 ?? editionActive?.msgChequeInfo1 ?? null,
        msgChequeInfo2:
          dto.msgChequeInfo2 ?? editionActive?.msgChequeInfo2 ?? null,
        msgInscriptionConfirmee:
          dto.msgInscriptionConfirmee ??
          editionActive?.msgInscriptionConfirmee ??
          null,
        msgRenseigneJoueurs:
          dto.msgRenseigneJoueurs ?? editionActive?.msgRenseigneJoueurs ?? null,
      },
      // Aucune année d'âge à la création (spec : pas de reprise automatique
      // d'une édition à l'autre) — include nécessaire uniquement pour que
      // toEditionEntity() reçoive un tableau `anneesAge` (vide ici).
      include: { anneesAge: true },
    });

    return toEditionEntity(edition);
  }
}
