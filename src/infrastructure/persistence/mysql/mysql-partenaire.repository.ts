import { Injectable } from '@nestjs/common';
import { Partenaire } from '@/domain/partenaire/entities/partenaire.entity';
import { PartenaireRepository } from '@/domain/partenaire/repositories/partenaire.repository';
import { PrismaService } from './prisma.service';
import { buildTeamPhotoUrl } from './mysql-utils';

@Injectable()
export class MySqlPartenaireRepository implements PartenaireRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllActifs(): Promise<Partenaire[]> {
    try {
      const rows = await this.prisma.$queryRaw<
        {
          ID: number;
          NOM: string;
          LOGO_URL: string | null;
          URL_SITE: string | null;
          TYPE: string;
          NAMING_GROUP: string | null;
          ORDRE: number;
        }[]
      >`
        SELECT ID, NOM, LOGO_URL, URL_SITE, TYPE, NAMING_GROUP, ORDRE
        FROM ta_partenaires
        WHERE ACTIF = 1
        ORDER BY ORDRE ASC
      `;

      return rows.map(
        (row) =>
          new Partenaire(
            row.ID,
            row.NOM,
            buildTeamPhotoUrl(row.LOGO_URL),
            row.URL_SITE ?? null,
            row.TYPE as 'naming' | 'general',
            (row.NAMING_GROUP ?? null) as 'A' | 'B' | 'C' | 'D' | null,
            row.ORDRE,
          ),
      );
    } catch {
      return [];
    }
  }
}
