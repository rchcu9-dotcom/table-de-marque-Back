import { Injectable } from '@nestjs/common';
import { MatchBut } from '../../domain/entities/match-but.entity';
import {
  CreateMatchButParams,
  MatchButRepository,
} from '../../domain/repositories/match-but.repository';
import { TableDeMarquePrismaService } from './table-de-marque-prisma.service';

@Injectable()
export class PrismaMatchButRepository implements MatchButRepository {
  constructor(private readonly prisma: TableDeMarquePrismaService) {}

  async create(params: CreateMatchButParams): Promise<MatchBut> {
    const row = await this.prisma.matchBut.create({
      data: {
        numMatch: params.numMatch,
        equipeId: params.equipeId,
        buteurId: params.buteurId,
        assist1Id: params.assist1Id ?? null,
        assist2Id: params.assist2Id ?? null,
        tempsJeuSecondes: params.tempsJeuSecondes,
      },
    });
    return this.toEntity(row);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.matchBut.delete({ where: { id } });
  }

  async findByNumMatch(numMatch: number): Promise<MatchBut[]> {
    const rows = await this.prisma.matchBut.findMany({
      where: { numMatch },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  private toEntity(row: {
    id: number;
    numMatch: number;
    equipeId: number;
    buteurId: number;
    assist1Id: number | null;
    assist2Id: number | null;
    tempsJeuSecondes: number;
    createdAt: Date;
  }): MatchBut {
    return new MatchBut(
      row.id,
      row.numMatch,
      row.equipeId,
      row.buteurId,
      row.assist1Id,
      row.assist2Id,
      row.tempsJeuSecondes,
      row.createdAt,
    );
  }
}
