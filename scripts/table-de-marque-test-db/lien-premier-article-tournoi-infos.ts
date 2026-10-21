// Base de TEST uniquement (garde-fou ADR-002) : fait pointer le premier article du
// premier chapitre de la présentation vers la page récapitulative /tournoi/infos.
// Chemin relatif : le front le traite en lien interne, quelle que soit l'origine
// (localhost:5173, staging, prod). Idempotent.
//
//   pnpm exec tsx scripts/table-de-marque-test-db/lien-premier-article-tournoi-infos.ts --target=rchcu11_tournoi_test [--dry-run]
import { openGuardedClient, redact } from './guard';

const LIEN = '/tournoi/infos';

async function main(): Promise<void> {
  const { prisma, args } = await openGuardedClient(process.argv.slice(2));
  try {
    // Même tri que l'affichage : chapitre (groupeOrdre), puis article (ordre), puis id.
    const premier = await prisma.presentationArticle.findFirst({
      orderBy: [{ groupeOrdre: 'asc' }, { ordre: 'asc' }, { id: 'asc' }],
      select: { id: true, groupe: true, titre: true, lienUrl: true },
    });
    if (!premier) {
      console.log('Aucun article de présentation : rien à faire.');
      return;
    }
    console.log(
      `Premier article : #${premier.id} « ${premier.titre} » (chapitre « ${premier.groupe} »), lien actuel : ${premier.lienUrl ?? '(aucun)'}`,
    );
    if (premier.lienUrl === LIEN) {
      console.log('Déjà à jour.');
      return;
    }
    if (args.dryRun) {
      console.log(`[dry-run] lienUrl serait remplacé par ${LIEN}`);
      return;
    }
    await prisma.presentationArticle.update({
      where: { id: premier.id },
      data: { lienUrl: LIEN },
    });
    console.log(`lienUrl mis à jour : ${LIEN}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(redact(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
