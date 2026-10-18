// Reprise des noms complets du référentiel des équipes à partir d'une liste de
// correspondance nom court → nom complet, sur la base de TEST uniquement
// (garde-fou ADR-002). Le SQL généré dans out/ sert à l'application manuelle
// sur une autre base, comme les migrations.
//
// Usage :
//   npx tsx scripts/equipes-referentiel/reprise-nom-complet.ts --target=rchcu11_tournoi_test --liste=<fichier.json>
//   ... --apply   (exécute les UPDATE ; sans --apply, affiche le plan et écrit le SQL)
//
// Format de la liste : voir correspondance-noms.exemple.json.
import * as fs from 'fs';
import * as path from 'path';
import { openGuardedClient, runMain } from '../table-de-marque-test-db/guard';
import {
  construireReprise,
  lireCorrespondances,
  versSql,
  type EquipeExistante,
} from './reprise-nom-complet.lib';

const OUT_DIR = path.resolve(__dirname, 'out');

interface RepriseArgs {
  liste: string | null;
  apply: boolean;
  /** Arguments laissés au garde-fou (--target=…). */
  reste: string[];
}

function parseRepriseArgs(argv: string[]): RepriseArgs {
  const args: RepriseArgs = { liste: null, apply: false, reste: [] };
  for (const arg of argv) {
    if (arg.startsWith('--liste=')) args.liste = arg.slice('--liste='.length);
    else if (arg === '--apply') args.apply = true;
    else args.reste.push(arg);
  }
  return args;
}

function afficher(titre: string, noms: string[]): void {
  console.log(`${titre} : ${noms.length}`);
  for (const nom of noms) console.log(`  - ${nom}`);
}

async function main(): Promise<number> {
  const args = parseRepriseArgs(process.argv.slice(2));
  if (!args.liste) {
    throw new Error('Argument manquant : --liste=<fichier de correspondance JSON>.');
  }
  const correspondances = lireCorrespondances(
    JSON.parse(fs.readFileSync(path.resolve(args.liste), 'utf8')),
  );

  const { prisma, target } = await openGuardedClient(args.reste);
  try {
    const equipes = await prisma.$queryRawUnsafe<EquipeExistante[]>(
      'SELECT `id`, `nom`, `nom_complet` AS nomComplet FROM `insc_equipes_referentiel`',
    );
    const plan = construireReprise(correspondances, equipes);

    console.log(`Liste : ${correspondances.length} ligne(s) — référentiel : ${equipes.length} équipe(s)`);
    afficher(
      'À mettre à jour',
      plan.majs.map((m) => `${m.nom} → ${m.nomComplet}`),
    );
    afficher('Déjà à jour', plan.dejaAJour);
    afficher('Absentes du référentiel (non créées)', plan.absentes);
    afficher('Exclues (sans nom court ou sans nom complet distinct)', plan.exclues);

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const sqlPath = path.join(OUT_DIR, `reprise-nom-complet-${target.database}.sql`);
    fs.writeFileSync(sqlPath, versSql(plan), 'utf8');
    console.log(`SQL écrit : ${sqlPath}`);

    if (!args.apply) {
      console.log('Aucune écriture en base (relancer avec --apply pour exécuter).');
      return 0;
    }
    for (const maj of plan.majs) {
      await prisma.$executeRawUnsafe(
        'UPDATE `insc_equipes_referentiel` SET `nom_complet` = ? WHERE `id` = ? AND `nom` = ?',
        maj.nomComplet,
        maj.id,
        maj.nom,
      );
    }
    console.log(`${plan.majs.length} équipe(s) mise(s) à jour.`);
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

runMain(main);
