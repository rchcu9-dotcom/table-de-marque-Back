import { Injectable } from '@nestjs/common';
import { Joueur } from '@/domain/joueur/entities/joueur.entity';
import { JoueurRepository } from '@/domain/joueur/repositories/joueur.repository';
import { PrismaService } from './prisma.service';

type TaJoueurRow = {
  ID: number;
  EQUIPE_ID: number;
  NUMERO: number;
  POSITION: string;
  NOM: string;
  PRENOM: string;
};

type TaEquipeRow = {
  ID: number;
  EQUIPE: string;
};

@Injectable()
export class MySqlJoueurRepository implements JoueurRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(_joueur: Joueur): Promise<Joueur> {
    throw new Error('MySQL repository is read-only.');
  }

  async update(_joueur: Joueur): Promise<Joueur> {
    throw new Error('MySQL repository is read-only.');
  }

  async delete(_id: string): Promise<void> {
    throw new Error('MySQL repository is read-only.');
  }

  async findAll(): Promise<Joueur[]> {
    const [joueurs, equipes] = await Promise.all([
      this.prisma.$queryRaw<TaJoueurRow[]>`
        SELECT ID, EQUIPE_ID, NUMERO, POSITION, NOM, PRENOM
        FROM ta_joueurs
        ORDER BY EQUIPE_ID ASC, NUMERO ASC
      `,
      this.prisma.$queryRaw<TaEquipeRow[]>`
        SELECT ID, EQUIPE FROM ta_equipes
      `,
    ]);

    const equipeNameById = new Map<number, string>();
    equipes.forEach((row) => equipeNameById.set(row.ID, row.EQUIPE));

    return joueurs.map((row) => {
      const equipeName = equipeNameById.get(row.EQUIPE_ID) ?? String(row.EQUIPE_ID);
      const displayName = `${row.PRENOM ?? ''} ${row.NOM ?? ''}`.trim() || row.NOM;
      return new Joueur(
        String(row.ID),
        equipeName,
        displayName,
        row.NUMERO,
        this.mapPoste(row.POSITION),
      );
    });
  }

  async findById(id: string): Promise<Joueur | null> {
    const all = await this.findAll();
    return all.find((j) => j.id === id) ?? null;
  }

  async findByEquipe(equipeId: string): Promise<Joueur[]> {
    const needle = (equipeId ?? '').trim().toLowerCase();
    const all = await this.findAll();
    return all.filter((j) => j.equipeId.trim().toLowerCase() === needle);
  }

  private mapPoste(value: string): Joueur['poste'] {
    const normalized = (value ?? '').trim().toUpperCase();
    if (normalized === 'D') return 'Def';
    if (normalized === 'G') return 'Gar';
    return 'Att';
  }
}
