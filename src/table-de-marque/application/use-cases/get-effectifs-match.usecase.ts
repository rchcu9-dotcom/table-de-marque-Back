import { Injectable } from '@nestjs/common';
import { TableDeMarquePrismaService } from '../../infrastructure/persistence/table-de-marque-prisma.service';
import { EditionResolverService } from '@/inscription/application/shared/edition-resolver.service';

type JoueurInfo = {
  id: number;
  nom: string;
  prenom: string;
  numero: number;
  poste: string;
};

type CoachInfo = {
  id: number;
  nom: string;
  prenom: string;
};

type EquipeEffectifs = {
  equipeId: number;
  nom: string;
  joueurs: JoueurInfo[];
  coachs: CoachInfo[];
};

export type EffectifsMatchResult = {
  equipe1: EquipeEffectifs;
  equipe2: EquipeEffectifs;
};

@Injectable()
export class GetEffectifsMatchUseCase {
  constructor(
    private readonly prisma: TableDeMarquePrismaService,
    private readonly editionResolver: EditionResolverService,
  ) {}

  async execute(numMatch: number): Promise<EffectifsMatchResult> {
    const match = await this.prisma.taMatch.findUnique({
      where: { numMatch },
      select: {
        equipeId1: true,
        equipeId2: true,
        equipe1: true,
        equipe2: true,
      },
    });

    const edition = await this.editionResolver
      .getEditionActive()
      .catch(() => null);

    const [equipe1, equipe2] = await Promise.all([
      this.resolveEquipe(
        match?.equipeId1 ?? null,
        match?.equipe1 ?? '',
        edition?.id ?? null,
      ),
      this.resolveEquipe(
        match?.equipeId2 ?? null,
        match?.equipe2 ?? '',
        edition?.id ?? null,
      ),
    ]);

    return { equipe1, equipe2 };
  }

  private async resolveEquipe(
    equipeId: number | null,
    nomFallback: string,
    editionId: number | null,
  ): Promise<EquipeEffectifs> {
    const empty = {
      equipeId: equipeId ?? 0,
      nom: nomFallback,
      joueurs: [],
      coachs: [],
    };

    if (!equipeId || !editionId) return empty;

    const taEquipe = await this.prisma.taEquipe.findUnique({
      where: { id: equipeId },
      select: { id: true, equipe: true, equipeRefId: true },
    });

    if (!taEquipe?.equipeRefId)
      return { ...empty, nom: taEquipe?.equipe ?? nomFallback };

    const inscription = await this.prisma.inscInscription.findFirst({
      where: { equipeRefId: taEquipe.equipeRefId, editionId },
      select: {
        dossier: {
          select: {
            joueurs: {
              select: {
                id: true,
                nom: true,
                prenom: true,
                numero: true,
                poste: true,
              },
            },
            coachs: {
              select: { id: true, nom: true, prenom: true },
            },
          },
        },
      },
    });

    const dossier = inscription?.dossier;

    return {
      equipeId,
      nom: taEquipe.equipe,
      joueurs: dossier?.joueurs ?? [],
      coachs: dossier?.coachs ?? [],
    };
  }
}
