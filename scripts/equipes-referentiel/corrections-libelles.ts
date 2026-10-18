// Correction des libellés fautifs du référentiel des équipes (espaces parasites,
// emoji, « Damarie », « Belougas De ») sur la base de TEST uniquement (garde-fou
// ADR-002), ou sur un fichier de correspondance. Le SQL généré dans out/ sert à
// l'application manuelle sur une autre base, comme les migrations.
//
// Usage :
//   npx tsx scripts/equipes-referentiel/corrections-libelles.ts --target=rchcu11_tournoi_test
//       affiche le plan et les anomalies restantes, écrit le SQL — aucune écriture en base
//   ... --apply      exécute les corrections (refusé s'il existe un conflit d'unicité)
//   ... --controle   n'affiche que les anomalies restantes ; code de sortie 1 s'il en reste
//   npx tsx scripts/equipes-referentiel/corrections-libelles.ts --liste=<fichier.json>
//       corrige une liste de correspondance vers out/<nom>.corrige.json — sans accès base
import * as fs from 'fs';
import * as path from 'path';
import type { PrismaClient } from '@prisma/client';
import { openGuardedClient, runMain } from '../table-de-marque-test-db/guard';
import {
  construireCorrections,
  corrigerListe,
  detecterAnomalies,
  versSql,
  type Anomalie,
  type EquipeACorriger,
  type InscriptionRattachee,
} from './corrections-libelles.lib';
import { lireCorrespondances } from './reprise-nom-complet.lib';

const OUT_DIR = path.resolve(__dirname, 'out');

const COLONNE = { nom: 'nom', nomComplet: 'nom_complet' } as const;

interface CorrectionsArgs {
  liste: string | null;
  apply: boolean;
  controle: boolean;
  /** Arguments laissés au garde-fou (--target=…). */
  reste: string[];
}

function parseCorrectionsArgs(argv: string[]): CorrectionsArgs {
  const args: CorrectionsArgs = { liste: null, apply: false, controle: false, reste: [] };
  for (const arg of argv) {
    if (arg.startsWith('--liste=')) args.liste = arg.slice('--liste='.length);
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--controle') args.controle = true;
    else args.reste.push(arg);
  }
  return args;
}

function montrer(valeur: string | null): string {
  return valeur === null ? 'NULL' : JSON.stringify(valeur);
}

function afficherAnomalies(anomalies: Anomalie[]): void {
  console.log(`Anomalies restantes (espaces, emoji) : ${anomalies.length}`);
  for (const a of anomalies) {
    console.log(`  - #${a.id} ${a.champ} ${montrer(a.valeur)} [${a.motifs.join(', ')}]`);
  }
}

function corrigerFichierListe(fichier: string): number {
  const source = path.resolve(fichier);
  const { liste, modifiees } = corrigerListe(
    lireCorrespondances(JSON.parse(fs.readFileSync(source, 'utf8'))),
  );
  console.log(`Liste : ${liste.length} ligne(s), ${modifiees.length} corrigée(s)`);
  for (const { avant, apres } of modifiees) {
    console.log(`  - ${montrer(avant.nom)} / ${montrer(avant.nomComplet)}`);
    console.log(`    → ${montrer(apres.nom)} / ${montrer(apres.nomComplet)}`);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const sortie = path.join(OUT_DIR, `${path.basename(source, '.json')}.corrige.json`);
  fs.writeFileSync(sortie, `${JSON.stringify(liste, null, 2)}\n`, 'utf8');
  console.log(`Liste corrigée écrite : ${sortie} (l'original n'est pas modifié)`);
  return 0;
}

async function chargerEquipes(prisma: PrismaClient): Promise<EquipeACorriger[]> {
  const equipes = await prisma.$queryRawUnsafe<
    { id: number; nom: string; nomComplet: string | null }[]
  >('SELECT `id`, `nom`, `nom_complet` AS nomComplet FROM `insc_equipes_referentiel` ORDER BY `id`');
  const inscriptions = await prisma.$queryRawUnsafe<
    (InscriptionRattachee & { equipeRefId: number })[]
  >(
    'SELECT `id`, `edition_id` AS editionId, `equipe_ref_id` AS equipeRefId, `equipe_nom` AS equipeNom ' +
      'FROM `insc_inscriptions` WHERE `equipe_ref_id` IS NOT NULL',
  );
  return equipes.map((equipe) => ({
    ...equipe,
    inscriptions: inscriptions
      .filter((i) => i.equipeRefId === equipe.id)
      .map(({ id, editionId, equipeNom }) => ({ id, editionId, equipeNom })),
  }));
}

async function main(): Promise<number> {
  const args = parseCorrectionsArgs(process.argv.slice(2));
  if (args.liste) return corrigerFichierListe(args.liste);

  const { prisma, target } = await openGuardedClient(args.reste);
  try {
    const equipes = await chargerEquipes(prisma);

    if (args.controle) {
      const anomalies = detecterAnomalies(equipes);
      afficherAnomalies(anomalies);
      return anomalies.length === 0 ? 0 : 1;
    }

    const plan = construireCorrections(equipes);
    console.log(`Référentiel : ${equipes.length} équipe(s)`);
    console.log(`À corriger : ${plan.majs.length}`);
    for (const m of plan.majs) {
      console.log(`  - #${m.id} ${m.champ} ${montrer(m.avant)} → ${montrer(m.apres)}`);
    }
    console.log(`À traiter à la main (nom court d'une équipe inscrite) : ${plan.aLaMain.length}`);
    for (const m of plan.aLaMain) {
      console.log(`  - #${m.id} nom ${montrer(m.avant)} → ${montrer(m.apres)}`);
      for (const i of m.inscriptions) {
        console.log(`      inscription #${i.id} (édition ${i.editionId}) : ${montrer(i.equipeNom)}`);
      }
    }
    console.log(`Conflits d'unicité : ${plan.conflits.length}`);
    for (const c of plan.conflits) {
      console.log(
        `  - #${c.id} nom ${montrer(c.avant)} → ${montrer(c.apres)} : déjà porté par #${c.autreId}`,
      );
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const sqlPath = path.join(OUT_DIR, `corrections-libelles-${target.database}.sql`);
    fs.writeFileSync(sqlPath, versSql(plan), 'utf8');
    console.log(`SQL écrit : ${sqlPath}`);

    if (plan.conflits.length > 0) {
      console.log('Conflit(s) à résoudre à la main : aucune écriture en base.');
      afficherAnomalies(detecterAnomalies(equipes));
      return 1;
    }
    if (!args.apply) {
      console.log('Aucune écriture en base (relancer avec --apply pour exécuter).');
      afficherAnomalies(detecterAnomalies(equipes));
      return 0;
    }

    for (const maj of plan.majs) {
      const colonne = COLONNE[maj.champ];
      await prisma.$executeRawUnsafe(
        `UPDATE \`insc_equipes_referentiel\` SET \`${colonne}\` = ? WHERE \`id\` = ? AND \`${colonne}\` = ?`,
        maj.apres,
        maj.id,
        maj.avant,
      );
    }
    console.log(`${plan.majs.length} correction(s) appliquée(s).`);
    afficherAnomalies(detecterAnomalies(await chargerEquipes(prisma)));
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

runMain(main);
