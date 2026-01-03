import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { Atelier } from '@/domain/challenge/entities/atelier.entity';
import { TentativeAtelier } from '@/domain/challenge/entities/tentative-atelier.entity';
import {
  ATELIER_REPOSITORY,
  AtelierRepository,
} from '@/domain/challenge/repositories/atelier.repository';
import {
  TENTATIVE_ATELIER_REPOSITORY,
  TentativeAtelierRepository,
} from '@/domain/challenge/repositories/tentative-atelier.repository';
import {
  JOUEUR_REPOSITORY,
  JoueurRepository,
} from '@/domain/joueur/repositories/joueur.repository';
import { Joueur } from '@/domain/joueur/entities/joueur.entity';
import { MOCK_TEAMS } from './mock-teams.data';

@Injectable()
export class ChallengeMockSeeder implements OnModuleInit {
  private readonly logger = new Logger(ChallengeMockSeeder.name);

  constructor(
    @Inject(ATELIER_REPOSITORY) private readonly ateliers: AtelierRepository,
    @Inject(TENTATIVE_ATELIER_REPOSITORY)
    private readonly tentatives: TentativeAtelierRepository,
    @Inject(JOUEUR_REPOSITORY) private readonly joueurRepo: JoueurRepository,
  ) {}

  async onModuleInit() {
    if ((process.env.USE_MOCK_CHALLENGE ?? '').toLowerCase() !== 'true') {
      return;
    }
    const driver = (process.env.MATCH_REPOSITORY_DRIVER ?? '').toLowerCase();
    if (driver && driver !== 'memory') {
      this.logger.warn(
        'Mock challenge seeding skipped: MATCH_REPOSITORY_DRIVER is not memory.',
      );
      return;
    }

    const ateliers: Atelier[] = [
      new Atelier(
        'atelier-vitesse',
        'Vitesse (qualifs)',
        'vitesse',
        'Jour 1 - PG',
        1,
      ),
      new Atelier('atelier-tir', 'Adresse au tir', 'tir', 'Jour 1 - PG', 2),
      new Atelier(
        'atelier-glisse',
        'Glisse & Crosse',
        'glisse_crosse',
        'Jour 1 - PG',
        3,
      ),
      new Atelier(
        'finale-vitesse-qf',
        'Finale Vitesse - Quarts',
        'vitesse',
        'Jour 3 - GG Surf #1',
        4,
      ),
      new Atelier(
        'finale-vitesse-df',
        'Finale Vitesse - Demis',
        'vitesse',
        'Jour 3 - GG Surf #2',
        5,
      ),
      new Atelier(
        'finale-vitesse-finale',
        'Finale Vitesse - Finale',
        'vitesse',
        'Jour 3 - GG Surf #3',
        6,
      ),
    ];
    if (typeof (this.ateliers as { clear?: () => Promise<void> }).clear === 'function') {
      await (this.ateliers as { clear: () => Promise<void> }).clear();
    }
    await this.ateliers.seed(ateliers);

    const joueurs = await this.ensurePlayers();
    const attempts: TentativeAtelier[] = [];

    // Créneaux jour 1 : 40 min par équipe à partir de 9h
    const baseJour1 = new Date('2026-05-23T09:00:00Z');
    const slotPerTeam = new Map<string, Date>();
    MOCK_TEAMS.forEach((t, idx) => {
      const d = new Date(baseJour1);
      d.setMinutes(d.getMinutes() + 40 * idx);
      slotPerTeam.set(t.id, d);
    });

    joueurs.forEach((j, idx) => {
      const slotDate = slotPerTeam.get(j.equipeId) ?? new Date();
      attempts.push(
        new TentativeAtelier(
          randomUUID(),
          'atelier-vitesse',
          j.id,
          'vitesse',
          { type: 'vitesse', tempsMs: 27000 + (idx % 16) * 400 },
          new Date(slotDate),
        ),
      );
      const tirScores = [0, 5, 20].map((base) =>
        Math.max(0, base - (idx % 4) * 2),
      );
      attempts.push(
        new TentativeAtelier(
          randomUUID(),
          'atelier-tir',
          j.id,
          'tir',
          {
            type: 'tir',
            tirs: tirScores,
            totalPoints: tirScores.reduce((a, b) => a + b, 0),
          },
          new Date(slotDate),
        ),
      );
      attempts.push(
        new TentativeAtelier(
          randomUUID(),
          'atelier-glisse',
          j.id,
          'glisse_crosse',
          {
            type: 'glisse_crosse',
            tempsMs: 40000 + (idx % 20) * 350,
            penalites: idx % 5,
          },
          new Date(slotDate),
        ),
      );
    });

    // Finals vitesse : 2 joueurs par équipe -> 32 joueurs, répartis en 8 quarts (4 joueurs)
    const playersByTeam = new Map<string, Joueur[]>();
    MOCK_TEAMS.forEach((t) => playersByTeam.set(t.id.trim().toLowerCase(), []));
    for (const j of joueurs) {
      const key = (j.equipeId ?? '').trim().toLowerCase();
      if (!playersByTeam.has(key)) playersByTeam.set(key, []);
      playersByTeam.get(key)!.push(j);
    }
    for (const t of MOCK_TEAMS) {
      const key = t.id.trim().toLowerCase();
      const arr = playersByTeam.get(key) ?? [];

      // Si 0 joueur, créer Joueur 1 et Joueur 2
      if (arr.length === 0) {
        const j1 = new Joueur(randomUUID(), t.id, `${t.id} Joueur 1`, 1, 'Att');
        const j2 = new Joueur(randomUUID(), t.id, `${t.id} Joueur 2`, 2, 'Att');
        await this.joueurRepo.create(j1);
        await this.joueurRepo.create(j2);
        arr.push(j1, j2);
      }
      // Si 1 seul joueur, ajouter un Joueur 2
      if (arr.length === 1) {
        const numero = arr[0].numero === 1 ? 2 : 1;
        const joueur = new Joueur(
          randomUUID(),
          t.id,
          `${t.id} Joueur ${numero}`,
          numero,
          'Att',
        );
        await this.joueurRepo.create(joueur);
        arr.push(joueur);
      }
      playersByTeam.set(key, arr);
    }

    const qfPlayers: Joueur[] = [];
    for (const t of MOCK_TEAMS) {
      const arr = playersByTeam.get(t.id.trim().toLowerCase()) ?? [];
      const sorted = [...arr].sort(
        (a, b) => a.numero - b.numero || a.nom.localeCompare(b.nom),
      );
      const picked: Joueur[] = [];
      for (const j of sorted) {
        if (picked.length >= 2) break;
        if (!picked.some((p) => p.nom === j.nom)) picked.push(j);
      }
      // Si on n'a pas 2 joueurs distincts, on en crée
      while (picked.length < 2) {
        const numero = sorted.length + 1;
        const joueur = new Joueur(
          randomUUID(),
          t.id,
          `${t.id} Joueur ${numero}`,
          numero,
          'Att',
        );
        await this.joueurRepo.create(joueur);
        sorted.push(joueur);
        picked.push(joueur);
      }
      qfPlayers.push(...picked);
    }
    const qfGroups: Joueur[][] = [];
    for (let i = 0; i < qfPlayers.length; i += 4) {
      qfGroups.push(qfPlayers.slice(i, i + 4));
    }

    const baseQf = new Date('2026-05-25T08:00:00Z');
    qfGroups.forEach((group, gIdx) => {
      group.forEach((j, idx) => {
        const d = new Date(baseQf);
        d.setMinutes(d.getMinutes() + gIdx * 10 + idx);
        attempts.push(
          new TentativeAtelier(
            randomUUID(),
            'finale-vitesse-qf',
            j.id,
            'vitesse',
            { type: 'vitesse', tempsMs: 26000 + (gIdx % 4) * 220 + idx * 80 },
            d,
          ),
        );
      });
    });
    this.logger.log(
      `QF Vitesse (32 attendus): ${qfPlayers.length} -> ${qfPlayers
        .map((j) => `${j.equipeId}:${j.nom}`)
        .join(', ')}`,
    );

    // Demi-finales : 4 groupes de 4, issus des deux premiers de chaque quart
    const dfPlayers: Joueur[] = qfGroups.flatMap((g) => g.slice(0, 2));
    const dfGroups: Joueur[][] = [];
    for (let i = 0; i < dfPlayers.length; i += 4) {
      dfGroups.push(dfPlayers.slice(i, i + 4));
    }
    const baseDf = new Date('2026-05-25T09:30:00Z');
    dfGroups.forEach((group, gIdx) => {
      group.forEach((j, idx) => {
        const d = new Date(baseDf);
        d.setMinutes(d.getMinutes() + gIdx * 12 + idx);
        attempts.push(
          new TentativeAtelier(
            randomUUID(),
            'finale-vitesse-df',
            j.id,
            'vitesse',
            { type: 'vitesse', tempsMs: 25500 + (gIdx % 2) * 200 + idx * 70 },
            d,
          ),
        );
      });
    });

    // Finale : 1 groupe de 4 (premier de chaque demie)
    const finalePlayers: Joueur[] = dfGroups.map((g) => g[0]).filter(Boolean);
    const baseFinale = new Date('2026-05-25T10:30:00Z');
    finalePlayers.forEach((j, idx) => {
      const d = new Date(baseFinale);
      d.setMinutes(d.getMinutes() + idx * 10);
      attempts.push(
        new TentativeAtelier(
          randomUUID(),
          'finale-vitesse-finale',
          j.id,
          'vitesse',
          { type: 'vitesse', tempsMs: 25000 + idx * 120 },
          d,
        ),
      );
    });

    await this.tentatives.clear();
    for (const att of attempts) {
      await this.tentatives.create(att);
    }

    this.logger.log(
      `Challenge mock seed loaded (${ateliers.length} ateliers, ${attempts.length} tentatives)`,
    );
  }

  private async ensurePlayers(): Promise<Joueur[]> {
    const positions: Array<'Att' | 'Def' | 'Gar'> = [
      'Att',
      'Def',
      'Att',
      'Def',
      'Gar',
    ];
    const existing = await this.joueurRepo.findAll();
    const byTeam = new Map<string, Joueur[]>();
    for (const j of existing) {
      const key = (j.equipeId ?? '').trim().toLowerCase();
      if (!byTeam.has(key)) byTeam.set(key, []);
      byTeam.get(key)!.push(j);
    }

    for (const team of MOCK_TEAMS) {
      const key = team.id.trim().toLowerCase();
      const current = byTeam.get(key) ?? [];
      if (current.length >= 15) continue;
      const start = current.length;
      for (let i = start; i < 15; i++) {
        const numero = i + 1;
        const poste = positions[i % positions.length];
        const joueur = new Joueur(
          randomUUID(),
          team.id,
          `${team.id} Joueur ${numero}`,
          numero,
          poste,
        );
        await this.joueurRepo.create(joueur);
      }
    }

    return this.joueurRepo.findAll();
  }
}
