// Correction des libellés fautifs du référentiel des équipes — logique pure,
// sans accès base
// (docs/specs/-correction-des-anomalies-dans-la-liste-contexte-dans-la-lis.md §1).
//
// Aucune création, aucune suppression. Un `nom` (nom court) référencé par une
// inscription n'est jamais renommé automatiquement : il est recopié dans
// `insc_inscriptions.equipe_nom` et sert de clé de correspondance avec
// `ta_equipes`.
import {
  corrigerLibelle,
  type ChampNom,
} from '../../src/inscription/domain/equipe-referentiel-corrections';
import {
  contientEmoji,
  normaliserEspaces,
  normaliserNomComplet,
} from '../../src/inscription/domain/equipe-referentiel-noms';
import { quoteSql, type Correspondance } from './reprise-nom-complet.lib';

export type InscriptionRattachee = { id: number; editionId: number; equipeNom: string };

export type EquipeACorriger = {
  id: number;
  nom: string;
  nomComplet: string | null;
  inscriptions: InscriptionRattachee[];
};

/** `apres` vaut null quand un nom complet corrigé devient vide ou égal au nom court. */
export type Correction = {
  id: number;
  champ: ChampNom;
  avant: string;
  apres: string | null;
};

export type PlanCorrections = {
  /** Appliquées par le script. */
  majs: Correction[];
  /** `nom` d'une équipe inscrite, ou `nom` qui deviendrait vide : non appliquées. */
  aLaMain: (Correction & { inscriptions: InscriptionRattachee[] })[];
  /** `nom` corrigé déjà porté par une autre ligne : le script n'écrit alors rien. */
  conflits: (Correction & { autreId: number })[];
};

export type MotifAnomalie = 'bord' | 'espaces' | 'emoji';

export type Anomalie = {
  id: number;
  champ: ChampNom;
  valeur: string;
  motifs: MotifAnomalie[];
};

const COLONNE: Record<ChampNom, string> = { nom: 'nom', nomComplet: 'nom_complet' };

/** Approximation de la collation `utf8mb4_unicode_ci` : casse, accents et espaces de fin ignorés. */
function cleUnicite(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[\u{0300}-\u{036F}]/gu, '')
    .toLowerCase()
    .trimEnd();
}

export function construireCorrections(equipes: readonly EquipeACorriger[]): PlanCorrections {
  const plan: PlanCorrections = { majs: [], aLaMain: [], conflits: [] };

  // Noms courts tels qu'ils seront après correction, pour détecter une collision.
  const idParCle = new Map<string, number>();
  for (const equipe of equipes) {
    if (corrigerLibelle(equipe.nom) === equipe.nom) {
      idParCle.set(cleUnicite(equipe.nom), equipe.id);
    }
  }

  for (const equipe of equipes) {
    let nomEffectif = equipe.nom;
    const nomCorrige = corrigerLibelle(equipe.nom);

    if (nomCorrige !== equipe.nom) {
      const correction: Correction = {
        id: equipe.id,
        champ: 'nom',
        avant: equipe.nom,
        apres: nomCorrige,
      };
      const cle = cleUnicite(nomCorrige);
      const autreId = idParCle.get(cle);
      if (autreId !== undefined && autreId !== equipe.id) {
        plan.conflits.push({ ...correction, autreId });
      } else if (!nomCorrige || equipe.inscriptions.length > 0) {
        plan.aLaMain.push({ ...correction, inscriptions: equipe.inscriptions });
      } else {
        plan.majs.push(correction);
        idParCle.set(cle, equipe.id);
        nomEffectif = nomCorrige;
      }
    }

    if (equipe.nomComplet !== null) {
      const nomCompletCorrige = normaliserNomComplet(
        nomEffectif,
        corrigerLibelle(equipe.nomComplet),
      );
      if (nomCompletCorrige !== equipe.nomComplet) {
        plan.majs.push({
          id: equipe.id,
          champ: 'nomComplet',
          avant: equipe.nomComplet,
          apres: nomCompletCorrige,
        });
      }
    }
  }

  return plan;
}

/** Libellés non conformes restants : espace de bord, espaces multiples ou non simples, emoji. */
export function detecterAnomalies(
  equipes: readonly Pick<EquipeACorriger, 'id' | 'nom' | 'nomComplet'>[],
): Anomalie[] {
  const anomalies: Anomalie[] = [];
  for (const equipe of equipes) {
    for (const champ of ['nom', 'nomComplet'] as const) {
      const valeur = equipe[champ];
      if (valeur === null) continue;
      const motifs: MotifAnomalie[] = [];
      if (valeur !== valeur.trim()) motifs.push('bord');
      if (valeur.trim() !== normaliserEspaces(valeur)) motifs.push('espaces');
      if (contientEmoji(valeur)) motifs.push('emoji');
      if (motifs.length > 0) anomalies.push({ id: equipe.id, champ, valeur, motifs });
    }
  }
  return anomalies;
}

/** Mêmes règles que pour la base, appliquées à la liste de correspondance (non modifiée). */
export function corrigerListe(liste: readonly Correspondance[]): {
  liste: Correspondance[];
  modifiees: { avant: Correspondance; apres: Correspondance }[];
} {
  const modifiees: { avant: Correspondance; apres: Correspondance }[] = [];
  const corrigee = liste.map((avant) => {
    const apres: Correspondance = {
      nom: corrigerLibelle(avant.nom),
      nomComplet: corrigerLibelle(avant.nomComplet),
    };
    if (apres.nom !== avant.nom || apres.nomComplet !== avant.nomComplet) {
      modifiees.push({ avant: { ...avant }, apres });
    }
    return apres;
  });
  return { liste: corrigee, modifiees };
}

/** UPDATE par identifiant ET valeur d'origine ; rejouable. */
export function versSql(plan: PlanCorrections): string {
  const lignes = [
    '-- Correction des libellés du référentiel des équipes.',
    '-- Généré par back/scripts/equipes-referentiel/corrections-libelles.ts — idempotent.',
    '-- Aucune création, aucune suppression.',
    '',
  ];
  if (plan.conflits.length > 0) {
    lignes.push('-- Conflit(s) d\'unicité sur `nom` : rien à exécuter tant qu\'ils ne sont pas résolus.');
    return `${lignes.join('\n')}\n`;
  }
  if (plan.majs.length === 0) {
    lignes.push('-- Rien à corriger.');
  }
  for (const maj of plan.majs) {
    const colonne = COLONNE[maj.champ];
    const valeur = maj.apres === null ? 'NULL' : quoteSql(maj.apres);
    lignes.push(
      `UPDATE \`insc_equipes_referentiel\` SET \`${colonne}\` = ${valeur} ` +
        `WHERE \`id\` = ${maj.id} AND \`${colonne}\` = ${quoteSql(maj.avant)};`,
    );
  }
  for (const correction of plan.aLaMain) {
    lignes.push(
      `-- À traiter à la main (équipe #${correction.id}, ${correction.inscriptions.length} inscription(s)) : ` +
        `nom ${quoteSql(correction.avant)} -> ${quoteSql(correction.apres ?? '')}`,
    );
  }
  return `${lignes.join('\n')}\n`;
}
