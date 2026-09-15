import { Injectable } from '@nestjs/common';
import { MatchPenalite } from '../../domain/entities/match-penalite.entity';
import {
  CreateMatchPenaliteParams,
  MatchPenaliteRepository,
} from '../../domain/repositories/match-penalite.repository';
import { TableDeMarquePrismaService } from './table-de-marque-prisma.service';

@Injectable()
export class PrismaMatchPenaliteRepository implements MatchPenaliteRepository {
  constructor(private readonly prisma: TableDeMarquePrismaService) {}

  async create(params: CreateMatchPenaliteParams): Promise<MatchPenalite> {
    const row = await this.prisma.matchPenalite.create({
      data: {
        numMatch: params.numMatch,
        equipeId: params.equipeId,
        joueurId: params.joueurId,
        typePenaliteCode: params.typePenaliteCode,
        dureeMinutes: params.dureeMinutes,
        tempsJeuDebut: params.tempsJeuDebut,
      },
    });
    return this.toEntity(row);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.matchPenalite.delete({ where: { id } });
  }

  async findByNumMatch(numMatch: number): Promise<MatchPenalite[]> {
    const rows = await this.prisma.matchPenalite.findMany({
      where: { numMatch },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  private toEntity(row: {
    id: number;
    numMatch: number;
    equipeId: number;
    joueurId: number;
    typePenaliteCode: string;
    dureeMinutes: number;
    tempsJeuDebut: number;
    createdAt: Date;
  }): MatchPenalite {
    return new MatchPenalite(
      row.id,
      row.numMatch,
      row.equipeId,
      row.joueurId,
      row.typePenaliteCode,
      row.dureeMinutes,
      row.tempsJeuDebut,
      row.createdAt,
    );
  }
}
