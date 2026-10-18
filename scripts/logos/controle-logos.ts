// Contrôle du dossier des logos d'équipe : noms sans fichier, fichiers sans nom,
// fichiers en double. Ce script ne supprime et ne renomme RIEN ; il n'écrit que
// sous out/. La base n'est lue qu'avec --db, et uniquement une base de TEST
// (garde-fou ADR-002) : les noms de prod et la liste passent par --noms=.
//
// Usage :
//   npx tsx scripts/logos/controle-logos.ts --seed --mocks
//   ... --db --target=rchcu11_tournoi_test      ajoute ta_equipes.EQUIPE de la base de test
//   ... --noms=<source>:<fichier.json>          répétable (ex. --noms=liste:… --noms=prod:…)
//   ... --logos=<dossier>                       défaut : front/public/assets/logos du dépôt voisin
//   ... --inventaire                            imprime le tableau Markdown pour le suivi
//   ... --instantane=<nom.json>                 écrit l'état (fichiers + manquants) dans out/
//   ... --avant=<fichier.json>                  compare à un instantané antérieur
//   ... --strict                                code de sortie 1 s'il reste manquant, orphelin ou doublon
//
// Format des fichiers de noms : voir noms.exemple.json et README.md.
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { MOCK_TEAMS } from '../../src/hooks/mock-teams.data';
import { openGuardedClient, runMain } from '../table-de-marque-test-db/guard';
import {
  comparerInstantanes,
  controlerLogos,
  extraireNomsSeed,
  lireNoms,
  versMarkdown,
  type FichierLogo,
  type Instantane,
  type SourceNoms,
} from './controle-logos.lib';

const OUT_DIR = path.resolve(__dirname, 'out');
const LOGOS_DIR = path.resolve(__dirname, '../../../front/public/assets/logos');
const SEED_PATH = path.resolve(__dirname, '../../prisma/seed-tournoi-2026.sql');

interface ControleArgs {
  logos: string;
  noms: { source: string; fichier: string }[];
  seed: boolean;
  mocks: boolean;
  db: boolean;
  inventaire: boolean;
  instantane: string | null;
  avant: string | null;
  strict: boolean;
  /** Arguments laissés au garde-fou (--target=…). */
  reste: string[];
}

function parseControleArgs(argv: string[]): ControleArgs {
  const args: ControleArgs = {
    logos: LOGOS_DIR,
    noms: [],
    seed: false,
    mocks: false,
    db: false,
    inventaire: false,
    instantane: null,
    avant: null,
    strict: false,
    reste: [],
  };
  for (const arg of argv) {
    if (arg.startsWith('--logos='))
      args.logos = path.resolve(arg.slice('--logos='.length));
    else if (arg.startsWith('--noms=')) {
      const valeur = arg.slice('--noms='.length);
      const coupe = valeur.indexOf(':');
      if (coupe <= 0 || coupe === valeur.length - 1) {
        throw new Error(
          `Argument invalide : ${arg} (attendu --noms=<source>:<fichier.json>).`,
        );
      }
      args.noms.push({
        source: valeur.slice(0, coupe),
        fichier: valeur.slice(coupe + 1),
      });
    } else if (arg === '--seed') args.seed = true;
    else if (arg === '--mocks') args.mocks = true;
    else if (arg === '--db') args.db = true;
    else if (arg === '--inventaire') args.inventaire = true;
    else if (arg.startsWith('--instantane='))
      args.instantane = arg.slice('--instantane='.length);
    else if (arg.startsWith('--avant='))
      args.avant = arg.slice('--avant='.length);
    else if (arg === '--strict') args.strict = true;
    else args.reste.push(arg);
  }
  return args;
}

function lireDossier(dossier: string): FichierLogo[] {
  return fs
    .readdirSync(dossier, { withFileTypes: true })
    .filter((entree) => entree.isFile())
    .map((entree) => {
      const contenu = fs.readFileSync(path.join(dossier, entree.name));
      return {
        fichier: entree.name,
        taille: contenu.length,
        sha256: crypto.createHash('sha256').update(contenu).digest('hex'),
      };
    });
}

async function lireNomsBase(reste: string[]): Promise<SourceNoms> {
  const { prisma, target } = await openGuardedClient(reste);
  try {
    const lignes = await prisma.$queryRawUnsafe<{ EQUIPE: string | null }[]>(
      'SELECT `EQUIPE` FROM `ta_equipes`',
    );
    return {
      source: `ta_equipes:${target.database}`,
      noms: lignes.map((l) => l.EQUIPE ?? ''),
    };
  } finally {
    await prisma.$disconnect();
  }
}

function afficher(titre: string, lignes: string[]): void {
  console.log(`${titre} : ${lignes.length}`);
  for (const ligne of lignes) console.log(`  - ${ligne}`);
}

async function main(): Promise<number> {
  const args = parseControleArgs(process.argv.slice(2));
  if (!args.db && args.reste.length > 0) {
    throw new Error(`Argument inconnu : ${args.reste[0]}`);
  }

  const sources: SourceNoms[] = [];
  for (const { source, fichier } of args.noms) {
    sources.push({
      source,
      noms: lireNoms(
        JSON.parse(fs.readFileSync(path.resolve(fichier), 'utf8')),
      ),
    });
  }
  if (args.db) sources.push(await lireNomsBase(args.reste));
  if (args.seed) {
    sources.push({
      source: 'seed-2026',
      noms: extraireNomsSeed(fs.readFileSync(SEED_PATH, 'utf8')),
    });
  }
  // Mocks : c'est `id` (« Le-Havre ») qui joue le rôle de nom d'équipe, pas `name` (nom long).
  if (args.mocks)
    sources.push({ source: 'mocks', noms: MOCK_TEAMS.map((t) => t.id) });
  if (sources.length === 0) {
    throw new Error(
      'Aucune source de noms (--noms=, --db, --seed ou --mocks).',
    );
  }

  const fichiers = lireDossier(args.logos);
  const rapport = controlerLogos(sources, fichiers);

  console.log(`Dossier : ${args.logos} — ${fichiers.length} fichier(s)`);
  for (const s of sources)
    console.log(`Source « ${s.source} » : ${s.noms.length} nom(s)`);
  afficher(
    'Noms sans fichier (logo manquant)',
    rapport.manquants.map(
      (m) => `${m.nom} → ${m.slug}.png (${m.sources.join(', ')})`,
    ),
  );
  afficher('Fichiers sans nom (orphelins)', rapport.orphelins);
  afficher(
    'Groupes de fichiers identiques',
    rapport.doublons.map((groupe) => groupe.join(' = ')),
  );

  if (args.inventaire) {
    console.log('');
    console.log(versMarkdown(rapport));
  }

  const etat: Instantane = {
    fichiers,
    manquants: rapport.manquants.map((m) => m.nom),
  };

  if (args.instantane) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    // Toujours sous out/ : seul le nom de fichier de l'argument est retenu.
    const cible = path.join(OUT_DIR, path.basename(args.instantane));
    fs.writeFileSync(cible, `${JSON.stringify(etat, null, 2)}\n`, 'utf8');
    console.log(`Instantané écrit : ${cible}`);
  }

  if (args.avant) {
    const local = path.resolve(args.avant);
    const source = fs.existsSync(local)
      ? local
      : path.join(OUT_DIR, path.basename(args.avant));
    const avant = JSON.parse(fs.readFileSync(source, 'utf8')) as Instantane;
    const ecart = comparerInstantanes(avant, etat);
    console.log('');
    console.log(
      `Écart depuis ${source} (${avant.fichiers.length} → ${fichiers.length} fichier(s))`,
    );
    afficher('Logos perdus', ecart.logosPerdus);
    afficher('Fichiers supprimés', ecart.supprimes);
    afficher(
      'Fichiers renommés',
      ecart.renommes.map((r) => `${r.de} → ${r.vers}`),
    );
    afficher('Fichiers ajoutés', ecart.ajoutes);
    afficher('Fichiers au contenu modifié', ecart.modifies);
    if (
      args.strict &&
      ecart.logosPerdus.length + ecart.ajoutes.length + ecart.modifies.length >
        0
    ) {
      return 1;
    }
  }

  const restant =
    rapport.manquants.length +
    rapport.orphelins.length +
    rapport.doublons.length;
  return args.strict && restant > 0 ? 1 : 0;
}

runMain(main);
