// Reprise des noms complets du référentiel des équipes — logique pure, sans
// accès base (docs/specs/-prise-en-compte-du-nom-court-pour-les-logos-contexte-actuel.md §7).
//
// Appariement sur le nom court exact. La reprise ne crée aucune ligne et ne
// renomme aucun `nom` : elle ne fait que renseigner `nom_complet`.

export type Correspondance = { nom: string; nomComplet: string };
export type EquipeExistante = { id: number; nom: string; nomComplet: string | null };

export type PlanReprise = {
  /** Lignes du référentiel dont `nom_complet` doit être écrit. */
  majs: { id: number; nom: string; nomComplet: string }[];
  /** Noms courts dont le nom complet est déjà celui de la liste (rejouer = rien). */
  dejaAJour: string[];
  /** Noms courts de la liste sans ligne au référentiel : jamais créées. */
  absentes: string[];
  /** Lignes de la liste sans nom court (ou sans nom complet) : ignorées. */
  exclues: string[];
};

export const NOM_COMPLET_MAX = 150;

/** Valide la forme du fichier de correspondance (tableau de { nom, nomComplet }). */
export function lireCorrespondances(contenu: unknown): Correspondance[] {
  if (!Array.isArray(contenu)) {
    throw new Error('Le fichier de correspondance doit être un tableau JSON.');
  }
  return contenu.map((ligne: unknown, index) => {
    const entree = (ligne ?? {}) as Record<string, unknown>;
    const nom = entree.nom ?? '';
    const nomComplet = entree.nomComplet ?? '';
    if (typeof nom !== 'string' || typeof nomComplet !== 'string') {
      throw new Error(`Ligne ${index + 1} : « nom » et « nomComplet » doivent être des chaînes.`);
    }
    return { nom, nomComplet };
  });
}

export function construireReprise(
  correspondances: readonly Correspondance[],
  equipes: readonly EquipeExistante[],
): PlanReprise {
  const plan: PlanReprise = { majs: [], dejaAJour: [], absentes: [], exclues: [] };
  const equipeParNom = new Map(equipes.map((e) => [e.nom.trim(), e]));
  const dejaVus = new Set<string>();

  for (const ligne of correspondances) {
    const nom = ligne.nom.trim();
    const nomComplet = ligne.nomComplet.trim();

    // Pas de nom court : la ligne n'entre pas dans le référentiel (c'est ce qui
    // écarte « Trois-Chêne » et « Ligue IDF Féminines »).
    if (!nom) {
      plan.exclues.push(nomComplet || '(ligne vide)');
      continue;
    }
    if (!nomComplet) {
      plan.exclues.push(nom);
      continue;
    }
    if (nomComplet.length > NOM_COMPLET_MAX) {
      throw new Error(
        `« ${nom} » : nom complet de ${nomComplet.length} caractères (maximum ${NOM_COMPLET_MAX}).`,
      );
    }
    if (dejaVus.has(nom)) {
      throw new Error(`« ${nom} » apparaît plusieurs fois dans la liste de correspondance.`);
    }
    dejaVus.add(nom);

    const equipe = equipeParNom.get(nom);
    if (!equipe) {
      plan.absentes.push(nom);
      continue;
    }
    // Même règle que la création : un nom complet égal au nom court n'apporte rien.
    if (nomComplet.toLowerCase() === nom.toLowerCase()) {
      plan.exclues.push(nom);
      continue;
    }
    if (equipe.nomComplet === nomComplet) {
      plan.dejaAJour.push(nom);
      continue;
    }
    plan.majs.push({ id: equipe.id, nom, nomComplet });
  }

  return plan;
}

export function quoteSql(valeur: string): string {
  return `'${valeur.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

/** UPDATE par identifiant ; rejouable (réécrit la même valeur). */
export function versSql(plan: PlanReprise): string {
  const lignes = [
    '-- Reprise des noms complets du référentiel des équipes.',
    '-- Généré par back/scripts/equipes-referentiel/reprise-nom-complet.ts — idempotent.',
    '-- Aucune création de ligne, aucun renommage de `nom`.',
    '',
  ];
  if (plan.majs.length === 0) {
    lignes.push('-- Rien à mettre à jour.');
  }
  for (const maj of plan.majs) {
    lignes.push(
      `UPDATE \`insc_equipes_referentiel\` SET \`nom_complet\` = ${quoteSql(maj.nomComplet)} ` +
        `WHERE \`id\` = ${maj.id} AND \`nom\` = ${quoteSql(maj.nom)};`,
    );
  }
  return `${lignes.join('\n')}\n`;
}
