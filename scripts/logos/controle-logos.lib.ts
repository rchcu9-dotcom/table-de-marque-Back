// Contrôle du dossier des logos d'équipe — logique pure, sans accès disque ni
// base (docs/specs/-nettoyage-des-fichiers-de-logo-contexte-la-gestion-des-fich.md §1, §5).
//
// Un fichier est « utilisé » si son nom est exactement `<slug>.png` pour au
// moins un nom d'équipe connu. Cette règle n'existe qu'ici ; rien dans ce
// module ne supprime ni ne renomme un fichier.
import { slugifyTeamName } from '../../src/infrastructure/persistence/mysql/mysql-utils';

/** D'où vient un nom : 'liste', 'ta_equipes:<base>', 'prod', 'seed-2026', 'mocks'… */
export type SourceNoms = { source: string; noms: string[] };

export type FichierLogo = { fichier: string; taille: number; sha256: string };

export type LigneInventaire = {
  fichier: string;
  /** Noms dont le slug + '.png' est ce fichier, avec leur source. Vide = sans nom. */
  justifications: { nom: string; source: string }[];
};

export type RapportLogos = {
  /** Noms dont `<slug>.png` est absent du dossier. */
  manquants: { nom: string; slug: string; sources: string[] }[];
  /** Fichiers qu'aucun nom ne produit (y compris toute extension autre que .png). */
  orphelins: string[];
  /** Groupes de fichiers de même empreinte (2 fichiers ou plus). */
  doublons: string[][];
  /** Tous les fichiers, triés, avec leurs justifications. */
  inventaire: LigneInventaire[];
};

export type Instantane = { fichiers: FichierLogo[]; manquants: string[] };

export type EcartInstantanes = {
  /** Noms servis avant, manquants après. */
  logosPerdus: string[];
  /** Fichiers disparus (hors renommages). */
  supprimes: string[];
  /** Même empreinte, nom différent. */
  renommes: { de: string; vers: string }[];
  /** Fichiers nouveaux, hors cibles de renommage. */
  ajoutes: string[];
  /** Même nom, empreinte différente. */
  modifies: string[];
};

const comparer = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function controlerLogos(
  sources: readonly SourceNoms[],
  fichiers: readonly FichierLogo[],
): RapportLogos {
  // slug → noms qui le produisent, toutes sources confondues.
  const parSlug = new Map<string, { nom: string; source: string }[]>();
  for (const { source, noms } of sources) {
    for (const brut of noms) {
      const nom = (brut ?? '').trim();
      const slug = slugifyTeamName(nom);
      if (!slug) continue;
      const connus = parSlug.get(slug) ?? [];
      if (!connus.some((c) => c.nom === nom && c.source === source))
        connus.push({ nom, source });
      parSlug.set(slug, connus);
    }
  }

  // Comparaison sensible à la casse : « Rennes.png » ne serait pas servi sous Linux.
  const presents = new Set(fichiers.map((f) => f.fichier));

  const manquants = [...parSlug.entries()]
    .filter(([slug]) => !presents.has(`${slug}.png`))
    .map(([slug, connus]) => ({
      nom: connus[0].nom,
      slug,
      sources: [...new Set(connus.map((c) => c.source))],
    }))
    .sort((a, b) => comparer(a.slug, b.slug));

  const inventaire = [...fichiers]
    .sort((a, b) => comparer(a.fichier, b.fichier))
    .map(({ fichier }) => ({
      fichier,
      justifications: fichier.endsWith('.png')
        ? (parSlug.get(fichier.slice(0, -'.png'.length)) ?? [])
        : [],
    }));

  const orphelins = inventaire
    .filter((l) => l.justifications.length === 0)
    .map((l) => l.fichier);

  const parEmpreinte = new Map<string, string[]>();
  for (const f of fichiers) {
    parEmpreinte.set(f.sha256, [
      ...(parEmpreinte.get(f.sha256) ?? []),
      f.fichier,
    ]);
  }
  const doublons = [...parEmpreinte.values()]
    .filter((groupe) => groupe.length > 1)
    .map((groupe) => [...groupe].sort(comparer))
    .sort((a, b) => comparer(a[0], b[0]));

  return { manquants, orphelins, doublons, inventaire };
}

/** Tableau JSON de chaînes, ou d'objets { nom } (format de correspondance-noms). */
export function lireNoms(contenu: unknown): string[] {
  if (!Array.isArray(contenu)) {
    throw new Error('Le fichier de noms doit être un tableau JSON.');
  }
  return contenu.map((ligne: unknown, index) => {
    if (typeof ligne === 'string') return ligne;
    const nom = (ligne as { nom?: unknown } | null)?.nom;
    if (typeof nom !== 'string') {
      throw new Error(
        `Ligne ${index + 1} : une chaîne ou un objet { "nom": "…" } est attendu.`,
      );
    }
    return nom;
  });
}

/** Découpe `a, 'b,c', \`d\`` sur les virgules de premier niveau (hors chaînes et parenthèses). */
function decouperValeurs(texte: string): string[] {
  const valeurs: string[] = [];
  let courant = '';
  let quote: string | null = null;
  let profondeur = 0;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (quote) {
      courant += c;
      if (c === '\\' && quote !== '`') courant += texte[++i] ?? '';
      else if (c === quote) {
        if (texte[i + 1] === quote) courant += texte[++i];
        else quote = null;
      }
      continue;
    }
    if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === '(') profondeur++;
    else if (c === ')') profondeur--;
    if (c === ',' && profondeur === 0) {
      valeurs.push(courant.trim());
      courant = '';
    } else courant += c;
  }
  if (courant.trim()) valeurs.push(courant.trim());
  return valeurs;
}

function sansQuotes(valeur: string): string {
  const q = valeur[0];
  if ((q !== "'" && q !== '"' && q !== '`') || valeur[valeur.length - 1] !== q)
    return valeur;
  const interieur = valeur
    .slice(1, -1)
    .split(q + q)
    .join(q);
  return q === '`' ? interieur : interieur.replace(/\\(.)/g, '$1');
}

/** Colonne EQUIPE des INSERT INTO `ta_equipes` d'un fichier SQL de seed. */
export function extraireNomsSeed(sql: string): string[] {
  const noms: string[] = [];
  const insert = /INSERT\s+INTO\s+`?ta_equipes`?\s*\(([^)]*)\)\s*VALUES/gi;
  let trouve: RegExpExecArray | null;
  while ((trouve = insert.exec(sql)) !== null) {
    const colonnes = decouperValeurs(trouve[1]).map((c) =>
      sansQuotes(c).toUpperCase(),
    );
    const rang = colonnes.indexOf('EQUIPE');
    if (rang < 0) continue;

    // Lignes de valeurs : une suite de ( … ) jusqu'au « ; » de fin d'instruction.
    let i = insert.lastIndex;
    let quote: string | null = null;
    let debut = -1;
    let profondeur = 0;
    for (; i < sql.length; i++) {
      const c = sql[i];
      if (quote) {
        if (c === '\\') i++;
        else if (c === quote) {
          if (sql[i + 1] === quote) i++;
          else quote = null;
        }
        continue;
      }
      if (c === "'" || c === '"') quote = c;
      else if (c === '(') {
        if (profondeur++ === 0) debut = i + 1;
      } else if (c === ')') {
        if (--profondeur === 0) {
          const valeur = decouperValeurs(sql.slice(debut, i))[rang];
          if (valeur !== undefined && valeur.toUpperCase() !== 'NULL')
            noms.push(sansQuotes(valeur));
        }
      } else if (c === ';' && profondeur === 0) break;
    }
    insert.lastIndex = i;
  }
  return noms;
}

export function comparerInstantanes(
  avant: Instantane,
  apres: Instantane,
): EcartInstantanes {
  const avantParNom = new Map(avant.fichiers.map((f) => [f.fichier, f]));
  const apresParNom = new Map(apres.fichiers.map((f) => [f.fichier, f]));

  const disparus = avant.fichiers.filter((f) => !apresParNom.has(f.fichier));
  const nouveaux = apres.fichiers.filter((f) => !avantParNom.has(f.fichier));

  // Un renommage = un fichier disparu dont l'empreinte reparaît sous un nom nouveau.
  const renommes: { de: string; vers: string }[] = [];
  const ciblesLibres = [...nouveaux];
  const supprimes: string[] = [];
  for (const f of disparus) {
    const rang = ciblesLibres.findIndex((c) => c.sha256 === f.sha256);
    if (rang < 0) supprimes.push(f.fichier);
    else
      renommes.push({
        de: f.fichier,
        vers: ciblesLibres.splice(rang, 1)[0].fichier,
      });
  }

  const dejaManquants = new Set(avant.manquants);
  return {
    logosPerdus: apres.manquants
      .filter((nom) => !dejaManquants.has(nom))
      .sort(comparer),
    supprimes: supprimes.sort(comparer),
    renommes: renommes.sort((a, b) => comparer(a.de, b.de)),
    ajoutes: ciblesLibres.map((f) => f.fichier).sort(comparer),
    modifies: apres.fichiers
      .filter((f) => {
        const ancien = avantParNom.get(f.fichier);
        return ancien !== undefined && ancien.sha256 !== f.sha256;
      })
      .map((f) => f.fichier)
      .sort(comparer),
  };
}

/** Tableau Markdown « Fichier | Justification » pour le fichier de suivi. */
export function versMarkdown(rapport: RapportLogos): string {
  const lignes = ['| Fichier | Justification |', '|---------|---------------|'];
  for (const { fichier, justifications } of rapport.inventaire) {
    const texte = justifications.length
      ? justifications.map((j) => `« ${j.nom} » (${j.source})`).join(', ')
      : 'sans nom';
    lignes.push(`| \`${fichier}\` | ${texte.replace(/\|/g, '\\|')} |`);
  }
  return `${lignes.join('\n')}\n`;
}
