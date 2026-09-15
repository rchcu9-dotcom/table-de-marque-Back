import { Injectable } from '@nestjs/common';
import { MatchTypePenalite } from '../../domain/entities/match-type-penalite.entity';
import { MatchTypePenaliteRepository } from '../../domain/repositories/match-type-penalite.repository';
import { TableDeMarquePrismaService } from './table-de-marque-prisma.service';

@Injectable()
export class PrismaMatchTypePenaliteRepository implements MatchTypePenaliteRepository {
  constructor(private readonly prisma: TableDeMarquePrismaService) {}

  async findAll(): Promise<MatchTypePenalite[]> {
    const rows = await this.prisma.matchTypePenalite.findMany({
      where: { actif: true },
      orderBy: { dureeMinutesDefaut: 'asc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async findByCode(code: string): Promise<MatchTypePenalite | null> {
    const row = await this.prisma.matchTypePenalite.findUnique({
      where: { code },
    });
    if (!row) return null;
    return this.toEntity(row);
  }

  private toEntity(row: {
    code: string;
    libelle: string;
    dureeMinutesDefaut: number;
    actif: boolean;
  }): MatchTypePenalite {
    return new MatchTypePenalite(
      row.code,
      row.libelle,
      row.dureeMinutesDefaut,
      row.actif,
    );
  }
}
