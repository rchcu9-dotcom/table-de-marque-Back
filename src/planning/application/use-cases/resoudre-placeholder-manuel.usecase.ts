import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PlanningMatchSlot } from '../../domain/entities/planning-match-slot.entity';
import {
  PLANNING_MATCH_SLOT_REPOSITORY,
  PlanningMatchSlotRepository,
} from '../../domain/repositories/planning-match-slot.repository';
import {
  PLANNING_MATCH_WRITER,
  PlanningMatchWriter,
} from '../../domain/repositories/planning-match-writer.repository';

/**
 * Résolution manuelle (spec §6) : filet de sécurité pour les cas non
 * résolubles automatiquement (égalité non départagée, donnée manquante) ou
 * une correction a posteriori voulue par l'organisateur. Contrairement à la
 * résolution automatique, un slot déjà résolu peut être réécrit ici — c'est
 * une action explicite de l'organisateur, pas une réévaluation silencieuse.
 */
@Injectable()
export class ResoudrePlaceholderManuelUseCase {
  constructor(
    @Inject(PLANNING_MATCH_SLOT_REPOSITORY)
    private readonly slotRepo: PlanningMatchSlotRepository,
    @Inject(PLANNING_MATCH_WRITER)
    private readonly matchWriter: PlanningMatchWriter,
  ) {}

  async execute(
    editionId: number,
    id: number,
    equipeId: number,
  ): Promise<PlanningMatchSlot> {
    const slot = await this.slotRepo.findById(id);
    if (!slot || slot.editionId !== editionId) {
      throw new NotFoundException(`Slot ${id} introuvable pour cette édition`);
    }

    const equipeNom = await this.matchWriter.trouverEquipeNomParId(equipeId);
    if (!equipeNom) {
      throw new BadRequestException(`Équipe ${equipeId} introuvable`);
    }

    await this.matchWriter.resoudreSlot(
      slot.numMatch,
      slot.cote,
      equipeId,
      equipeNom,
    );
    return this.slotRepo.marquerResolu(slot.id, equipeId, equipeNom, true);
  }
}
