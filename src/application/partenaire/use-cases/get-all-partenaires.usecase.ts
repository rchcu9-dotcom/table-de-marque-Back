import { Injectable, Inject } from '@nestjs/common';
import {
  PARTENAIRE_REPOSITORY,
  type PartenaireRepository,
} from '@/domain/partenaire/repositories/partenaire.repository';

@Injectable()
export class GetAllPartenairesUseCase {
  constructor(
    @Inject(PARTENAIRE_REPOSITORY)
    private readonly repo: PartenaireRepository,
  ) {}

  execute() {
    return this.repo.findAllActifs();
  }
}
