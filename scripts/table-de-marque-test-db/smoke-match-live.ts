// Test fonctionnel (CA7) de la brique table de marque sur la base de TEST, avec les
// VRAIS repositories Prisma : match_live → but → pénalité → suppression d'un but avec
// recalcul de score1_cache / score2_cache. Ne supprime que ce qu'il a créé.
//
// Usage : npx tsx scripts/table-de-marque-test-db/smoke-match-live.ts --target=rchcu11_tournoi_test
import { openGuardedClient, runMain } from './guard';
import { MatchLive } from '../../src/table-de-marque/domain/entities/match-live.entity';
import { MatchLiveEtat } from '../../src/table-de-marque/domain/enums/match-live-etat.enum';
import { PrismaMatchLiveRepository } from '../../src/table-de-marque/infrastructure/persistence/prisma-match-live.repository';
import { PrismaMatchButRepository } from '../../src/table-de-marque/infrastructure/persistence/prisma-match-but.repository';
import { PrismaMatchPenaliteRepository } from '../../src/table-de-marque/infrastructure/persistence/prisma-match-penalite.repository';
import type { TableDeMarquePrismaService } from '../../src/table-de-marque/infrastructure/persistence/table-de-marque-prisma.service';

runMain(async () => {
  const { prisma } = await openGuardedClient(process.argv.slice(2));
  const failures: string[] = [];
  const check = (label: string, ok: boolean, detail = '') => {
    console.log(`  [${ok ? 'OK' : 'KO'}] ${label}${ok || !detail ? '' : ` — ${detail}`}`);
    if (!ok) failures.push(label);
  };

  let numMatch: number | null = null;

  // Nettoyage explicite (ordre enfants → parent) : la FK réellement présente sur la base de
  // test est ON DELETE RESTRICT (schema.prisma), pas le CASCADE de migration.sql. Ne s'applique
  // qu'au numMatch créé par ce script (aucun match_live n'y existait au départ).
  const nettoyer = async (n: number) => {
    await prisma.matchBut.deleteMany({ where: { numMatch: n } });
    await prisma.matchPenalite.deleteMany({ where: { numMatch: n } });
    await prisma.matchLive.delete({ where: { numMatch: n } });
  };

  try {
    // Les repositories n'utilisent que les délégués de modèles Prisma : le client gardé convient.
    const service = prisma as unknown as TableDeMarquePrismaService;
    const matchLiveRepo = new PrismaMatchLiveRepository(service);
    const butRepo = new PrismaMatchButRepository(service);
    const penaliteRepo = new PrismaMatchPenaliteRepository(service);

    console.log('\nPré-requis (lecture seule) :');
    const types = await prisma.matchTypePenalite.findMany();
    check('match_types_penalite contient ≥ 3 types', types.length >= 3, `constaté ${types.length}`);
    await prisma.taEquipe.findFirst({ select: { equipeRefId: true } });
    check('ta_equipes.EQUIPE_REF_ID lisible via Prisma', true);

    const candidats = await prisma.taMatch.findMany({
      where: { equipeId1: { not: null }, equipeId2: { not: null } },
      select: { numMatch: true, equipeId1: true, equipeId2: true },
      orderBy: { numMatch: 'desc' },
      take: 200,
    });
    let match: { numMatch: number; equipeId1: number; equipeId2: number } | null = null;
    for (const c of candidats) {
      if (c.equipeId1 === null || c.equipeId2 === null || c.equipeId1 === c.equipeId2) continue;
      const deja = await prisma.matchLive.findUnique({ where: { numMatch: c.numMatch } });
      if (!deja) {
        match = { numMatch: c.numMatch, equipeId1: c.equipeId1, equipeId2: c.equipeId2 };
        break;
      }
    }
    if (!match) {
      console.error('\nNON EXÉCUTABLE : aucun match de ta_matchs (avec les deux équipes renseignées) sans match_live existant.');
      return 2;
    }
    console.log(`  match de test : n°${match.numMatch} (équipes ${match.equipeId1} / ${match.equipeId2}, ta_matchs en lecture seule)`);

    // Les FK issues de schema.prisma exigent de vrais joueurs (insc_joueurs_dossier) pour
    // buteur_id / joueur_id : lecture seule d'ids existants, aucune création.
    const joueurs = await prisma.inscJoueurDossier.findMany({ select: { id: true }, take: 2, orderBy: { id: 'asc' } });
    if (joueurs.length === 0) {
      console.error('\nNON EXÉCUTABLE : aucun joueur dans insc_joueurs_dossier (requis par les FK de match_buts / match_penalites).');
      return 2;
    }
    const joueurA = joueurs[0].id;
    const joueurB = joueurs[1]?.id ?? joueurA;

    const avant = {
      live: await prisma.matchLive.count(),
      buts: await prisma.matchBut.count(),
      penalites: await prisma.matchPenalite.count(),
    };

    console.log('\nParcours :');
    const now = new Date();
    numMatch = match.numMatch;
    await matchLiveRepo.upsert(
      new MatchLive(match.numMatch, MatchLiveEtat.EN_PAUSE, 0, false, null, 0, 0, now, now),
    );
    check('match_live créé (EN_PAUSE, scores 0-0)', (await matchLiveRepo.findByNumMatch(match.numMatch))?.etat === MatchLiveEtat.EN_PAUSE);

    const but1 = await butRepo.create({ numMatch: match.numMatch, equipeId: match.equipeId1, buteurId: joueurA, tempsJeuSecondes: 60 });
    await butRepo.create({ numMatch: match.numMatch, equipeId: match.equipeId2, buteurId: joueurB, tempsJeuSecondes: 120 });
    let live = await matchLiveRepo.recomputeScore(match.numMatch);
    check('2 buts (un par équipe) → score cache 1-1', live.score1Cache === 1 && live.score2Cache === 1, `${live.score1Cache}-${live.score2Cache}`);

    const penalite = await penaliteRepo.create({
      numMatch: match.numMatch,
      equipeId: match.equipeId1,
      joueurId: joueurA,
      typePenaliteCode: 'mineure',
      dureeMinutes: 2,
      tempsJeuDebut: 90,
    });
    check('pénalité « mineure » créée (FK vers match_types_penalite)', (await penaliteRepo.findByNumMatch(match.numMatch)).length === 1);

    await butRepo.delete(but1.id);
    live = await matchLiveRepo.recomputeScore(match.numMatch);
    check('suppression du but de l\'équipe 1 → score cache 0-1', live.score1Cache === 0 && live.score2Cache === 1, `${live.score1Cache}-${live.score2Cache}`);
    check('un seul but restant', (await butRepo.findByNumMatch(match.numMatch)).length === 1);

    await penaliteRepo.delete(penalite.id);
    check('pénalité supprimée', (await penaliteRepo.findByNumMatch(match.numMatch)).length === 0);

    // Nettoyage : uniquement les lignes créées ici.
    await nettoyer(match.numMatch);
    numMatch = null;
    const apres = {
      live: await prisma.matchLive.count(),
      buts: await prisma.matchBut.count(),
      penalites: await prisma.matchPenalite.count(),
    };
    check('nettoyage : volumétries match_live/buts/pénalités identiques à l\'état initial', JSON.stringify(avant) === JSON.stringify(apres), `${JSON.stringify(avant)} → ${JSON.stringify(apres)}`);
  } finally {
    if (numMatch !== null) {
      try {
        await nettoyer(numMatch);
      } catch (error) {
        console.error(`ATTENTION : nettoyage du match n°${numMatch} impossible, lignes à supprimer à la main : ${error instanceof Error ? error.message.split('\n').pop() : String(error)}`);
        failures.push('nettoyage final');
      }
    }
    await prisma.$disconnect();
  }

  console.log(`\nRésultat : ${failures.length === 0 ? 'PARCOURS OK' : `${failures.length} contrôle(s) en échec`}`);
  return failures.length === 0 ? 0 : 1;
});
