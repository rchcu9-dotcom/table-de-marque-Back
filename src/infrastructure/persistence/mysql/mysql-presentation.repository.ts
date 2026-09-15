import { Injectable } from '@nestjs/common';
import { PresentationRepository } from '@/domain/presentation/repositories/presentation.repository';
import {
  ArticlePresentation,
  PresentationGroupe,
} from '@/domain/presentation/entities/article-presentation.entity';
import { PresentationArticleRecord } from '@/domain/presentation/repositories/presentation-article.repository';
import { MySqlPresentationArticleRepository } from './mysql-presentation-article.repository';
import { extractDriveFileId } from '../google-sheets/drive-url.util';

/**
 * Les images sont saisies en admin sous forme d'URL Drive (aucun upload). Le navigateur
 * du visiteur ne peut pas charger `drive.google.com`/`googleusercontent.com` en direct —
 * Chrome bloque ces domaines en tant que ressource intégrée cross-origin (ERR_BLOCKED_BY_ORB,
 * confirmé y compris pour un seul fichier, hors toute rafale — cf. DriveImageProxyService)
 * — donc on ne renvoie jamais l'URL Drive telle quelle : on pointe vers notre propre relais
 * `/presentation/image/:fileId`, qui fait l'appel à Drive côté serveur. Largeur 1600 et non
 * 600 : ces images servent de fond plein écran. Une URL hors Drive (pas de fileId extractible)
 * est laissée telle quelle — rien à proxifier, ce n'est pas le problème qu'on corrige ici.
 */
const BACKGROUND_WIDTH = 1600;

function toDisplayableImageUrl(url: string | null): string | null {
  if (!url) return null;
  const fileId = extractDriveFileId(url);
  return fileId ? `/presentation/image/${fileId}?w=${BACKGROUND_WIDTH}` : url;
}

/**
 * Vue publique (GET /presentation, mise en cache) construite à partir des mêmes lignes
 * que l'admin (MySqlPresentationArticleRepository) — les groupes sont triés par
 * `groupeOrdre` (dupliqué sur chaque article du groupe), avec repli de l'image de
 * fond du groupe sur l'image du premier article si `groupeImageUrl` est absente.
 */
@Injectable()
export class MySqlPresentationRepository implements PresentationRepository {
  constructor(private readonly articles: MySqlPresentationArticleRepository) {}

  async findAll(): Promise<PresentationGroupe[]> {
    const rows = await this.articles.findAllOrdered();

    const groupesByNom = new Map<
      string,
      {
        nomEn: string;
        articles: ArticlePresentation[];
        ordre: number;
        dureeMs: number;
        imageUrl: string | null;
      }
    >();

    for (const row of rows) {
      let entry = groupesByNom.get(row.groupe);
      if (!entry) {
        entry = {
          nomEn: row.groupeEn || row.groupe,
          articles: [],
          ordre: row.groupeOrdre,
          dureeMs: row.groupeDureeMs,
          imageUrl: row.groupeImageUrl,
        };
        groupesByNom.set(row.groupe, entry);
      }
      entry.articles.push(this.toArticle(row));
    }

    return Array.from(groupesByNom.entries())
      .map(
        ([nom, { nomEn, articles, ordre, dureeMs, imageUrl }]) =>
          new PresentationGroupe(
            nom,
            nomEn,
            articles,
            ordre,
            dureeMs,
            toDisplayableImageUrl(imageUrl) ?? articles[0]?.imageUrl ?? null,
          ),
      )
      .sort((a, b) => a.ordre - b.ordre);
  }

  private toArticle(row: PresentationArticleRecord): ArticlePresentation {
    return new ArticlePresentation(
      row.groupe,
      row.groupeEn || row.groupe,
      row.titre,
      row.titreEn || row.titre,
      row.description,
      row.descriptionEn || row.description,
      toDisplayableImageUrl(row.imageUrl),
      row.lienUrl,
      row.lieu,
      row.mapsQuery,
      row.surtitre,
      row.surtitreEn || row.surtitre,
      row.faits,
      row.faitsEn || row.faits,
      row.titreAccroche,
      row.titreAccrocheEn || row.titreAccroche,
      row.descriptionCourte,
      row.descriptionCourteEn || row.descriptionCourte,
    );
  }
}
