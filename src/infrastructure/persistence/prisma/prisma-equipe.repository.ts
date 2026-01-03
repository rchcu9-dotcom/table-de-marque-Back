import { Injectable, Logger } from '@nestjs/common';

import {
  Equipe,
  PouleClassement,
  PouleCode,
} from '@/domain/equipe/entities/equipe.entity';
import { EquipeRepository } from '@/domain/equipe/repositories/equipe.repository';
import { MOCK_TEAMS } from '@/hooks/mock-teams.data';
import { PrismaService } from './prisma.service';

type RawEquipeRow = {
  ID?: string | number;
  id?: string | number;
  equipe?: string;
  EQUIPE?: string;
  IMAGE?: string | null;
  image?: string | null;
};

const DEFAULT_STATS = {
  rang: 0,
  joues: 0,
  victoires: 0,
  nuls: 0,
  defaites: 0,
  points: 0,
  bp: 0,
  bc: 0,
  diff: 0,
};

@Injectable()
export class PrismaEquipeRepository implements EquipeRepository {
  private readonly logger = new Logger(PrismaEquipeRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  private normalize(value: string | number | undefined | null): string {
    if (value === undefined || value === null) return '';
    return String(value).trim().toLowerCase();
  }

  private mapRowToEquipe(row: RawEquipeRow): Equipe | null {
    const id = row.id ?? row.ID;
    const name = row.equipe ?? row.EQUIPE;
    if (!id || !name) return null;

    const normalizedId = this.normalize(id);
    const normalizedName = this.normalize(name);

    const mock = MOCK_TEAMS.find(
      (t) =>
        this.normalize(t.id) === normalizedId ||
        this.normalize(t.name) === normalizedName,
    );

    const logo = row.image ?? row.IMAGE ?? mock?.logo ?? null;
    const pouleCode: PouleCode = mock?.id ?? String(id);

    return new Equipe(
      String(id),
      name,
      logo,
      pouleCode,
      mock?.name ?? name,
      DEFAULT_STATS.rang,
      DEFAULT_STATS.joues,
      DEFAULT_STATS.victoires,
      DEFAULT_STATS.nuls,
      DEFAULT_STATS.defaites,
      DEFAULT_STATS.points,
      DEFAULT_STATS.bp,
      DEFAULT_STATS.bc,
      DEFAULT_STATS.diff,
    );
  }

  async findAllEquipes(): Promise<Equipe[]> {
    try {
      const rows = await this.prisma.$queryRaw<RawEquipeRow[]>`
        SELECT ID, EQUIPE, IMAGE FROM ta_equipes
      `;

      const seen = new Set<string>();
      const mapped: Equipe[] = [];

      for (const row of rows) {
        const equipe = this.mapRowToEquipe(row);
        if (!equipe) continue;
        const key = this.normalize(equipe.id);
        if (seen.has(key)) continue;
        seen.add(key);
        mapped.push(equipe);
      }

      for (const mock of MOCK_TEAMS) {
        const key = this.normalize(mock.id);
        if (seen.has(key)) continue;
        seen.add(key);
        mapped.push(
          new Equipe(
            mock.id,
            mock.name,
            mock.logo,
            mock.id,
            mock.name,
            DEFAULT_STATS.rang,
            DEFAULT_STATS.joues,
            DEFAULT_STATS.victoires,
            DEFAULT_STATS.nuls,
            DEFAULT_STATS.defaites,
            DEFAULT_STATS.points,
            DEFAULT_STATS.bp,
            DEFAULT_STATS.bc,
            DEFAULT_STATS.diff,
          ),
        );
      }

      return mapped;
    } catch (err) {
      this.logger.error('findAllEquipes failed', err as Error);
      return [];
    }
  }

  async findEquipeById(id: string): Promise<Equipe | null> {
    const all = await this.findAllEquipes();
    const target = this.normalize(id);
    return (
      all.find(
        (eq) =>
          this.normalize(eq.id) === target ||
          this.normalize(eq.name) === target ||
          this.normalize(eq.pouleCode) === target,
      ) ?? null
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findClassementByPoule(
    pouleCode: PouleCode,
  ): Promise<PouleClassement | null> {
    this.logger.warn(`Classement not available for poule ${pouleCode} (MySQL)`);
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async findClassementByTeamName(
    teamName: string,
  ): Promise<PouleClassement | null> {
    this.logger.warn(`Classement not available for team ${teamName} (MySQL)`);
    return null;
  }
}
