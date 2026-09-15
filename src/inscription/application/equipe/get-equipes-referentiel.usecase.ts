import { Injectable } from '@nestjs/common';
import { InscriptionPrismaService } from '../../infrastructure/persistence/inscription-prisma.service';
import { EquipeReferentiel } from '../../domain/entities/equipe-referentiel.entity';
import { toEquipeReferentielEntity } from '../../infrastructure/persistence/equipe-referentiel.mapper';
import { EditionResolverService } from '../shared/edition-resolver.service';
import type { InscEditionAvecAnneesAge } from '../../infrastructure/persistence/edition.mapper';

@Injectable()
export class GetEquipesReferentielUseCase {
  constructor(
    private readonly prisma: InscriptionPrismaService,
    private readonly editionResolver: EditionResolverService,
  ) {}

  async execute(toutesLesEquipes = false): Promise<EquipeReferentiel[]> {
    const where = toutesLesEquipes ? {} : { active: true };
    const [equipes, equipeIdsAvecCandidature] = await Promise.all([
      this.prisma.inscEquipeReferentiel.findMany({
        where,
        orderBy: { nom: 'asc' },
      }),
      this.getEquipeIdsAvecCandidature(),
    ]);
    return equipes.map((equipe) =>
      toEquipeReferentielEntity(
        equipe,
        equipeIdsAvecCandidature.has(equipe.id),
      ),
    );
  }

  /**
   * Une candidature (quel que soit son statut, y compris REFUSEE) verrouille
   * la paire édition/équipe via la contrainte unique `editionId_equipeRefId`
   * (cf. SoumettreCanditatureUseCase) : on reflète donc la même règle ici,
   * sans distinction de statut, pour prévenir le clic côté UX plutôt que de
   * laisser le rejet arriver uniquement après soumission.
   */
  private async getEquipeIdsAvecCandidature(): Promise<Set<number>> {
    let edition: InscEditionAvecAnneesAge;
    try {
      edition = await this.editionResolver.getEditionActive();
    } catch {
      return new Set();
    }
    const inscriptions = await this.prisma.inscInscription.findMany({
      where: { editionId: edition.id },
      select: { equipeRefId: true },
    });
    return new Set(
      inscriptions
        .map((inscription) => inscription.equipeRefId)
        .filter((id): id is number => id !== null),
    );
  }
}
