import { Inject, Injectable } from '@nestjs/common';
import {
  PRESENTATION_ARTICLE_REPOSITORY,
  PresentationArticleRecord,
  type PresentationArticleRepository,
} from '@/domain/presentation/repositories/presentation-article.repository';
import { UpsertPresentationArticleDto } from '../dto/upsert-presentation-article.dto';
import { resolveGroupeMeta } from './resolve-groupe-meta.util';

@Injectable()
export class CreerPresentationArticleUseCase {
  constructor(
    @Inject(PRESENTATION_ARTICLE_REPOSITORY)
    private readonly repo: PresentationArticleRepository,
  ) {}

  async execute(
    dto: UpsertPresentationArticleDto,
  ): Promise<PresentationArticleRecord> {
    const existingArticles = await this.repo.findAllOrdered();
    const groupeMeta = resolveGroupeMeta(existingArticles, dto.groupe);

    return this.repo.create({
      groupe: dto.groupe,
      groupeEn: dto.groupeEn,
      surtitre: dto.surtitre ?? '',
      surtitreEn: dto.surtitreEn ?? '',
      faits: dto.faits ?? '',
      faitsEn: dto.faitsEn ?? '',
      titre: dto.titre,
      titreEn: dto.titreEn,
      description: dto.description,
      descriptionEn: dto.descriptionEn,
      titreAccroche: dto.titreAccroche ?? '',
      titreAccrocheEn: dto.titreAccrocheEn ?? '',
      descriptionCourte: dto.descriptionCourte ?? '',
      descriptionCourteEn: dto.descriptionCourteEn ?? '',
      imageUrl: dto.imageUrl ?? null,
      lienUrl: dto.lienUrl ?? null,
      lieu: dto.lieu ?? null,
      mapsQuery: dto.mapsQuery ?? null,
      ordre: dto.ordre,
      ...groupeMeta,
    });
  }
}
