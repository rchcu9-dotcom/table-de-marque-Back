import { Injectable } from '@nestjs/common';
import { FormatGraphe } from '../../domain/entities/format/format-graphe.entity';
import { FormatGroupe } from '../../domain/entities/format/format-groupe.entity';

export type ValidationResult =
  | { valide: true }
  | { valide: false; erreurs: string[] };

@Injectable()
export class FormatGrapheValidationService {
  /**
   * Validation permissive pendant la construction : tolère les rangs
   * NON_DEFINI, signale seulement les invariants structurels violés.
   * Un groupe à 1 place est signalé (jamais valide) ; 0 places = vide,
   * acceptable en cours de construction.
   */
  validerPartiel(graphe: FormatGraphe): ValidationResult {
    const erreurs: string[] = [];

    for (const groupe of graphe.groupes) {
      if (groupe.places.length === 1) {
        erreurs.push(
          `Groupe "${groupe.nom}" (id=${groupe.id}) a exactement 1 place — il doit en avoir 0, 2 ou ≥3`,
        );
      }
    }

    return erreurs.length === 0 ? { valide: true } : { valide: false, erreurs };
  }

  /**
   * Validation stricte avant activation (génération de matchs) : tous les
   * rangs doivent être ELIMINE ou LIE, aucun NON_DEFINI ne reste, et chaque
   * groupe doit avoir exactement 2 ou ≥3 places.
   */
  validerActivable(graphe: FormatGraphe): ValidationResult {
    const erreurs: string[] = [];
    const groupeById = new Map<number, FormatGroupe>(
      graphe.groupes.map((g) => [g.id, g]),
    );

    for (const groupe of graphe.groupes) {
      if (groupe.places.length < 2) {
        erreurs.push(
          `Groupe "${groupe.nom}" (id=${groupe.id}) a ${groupe.places.length} place(s) — minimum 2 requis`,
        );
      }
    }

    for (const lien of graphe.liens) {
      if (lien.etat === 'NON_DEFINI') {
        const groupe = groupeById.get(lien.groupeSourceId);
        erreurs.push(
          `Rang ${lien.rangSource} du groupe "${groupe?.nom ?? lien.groupeSourceId}" est NON_DEFINI — résolvez-le en ELIMINE ou en lien vers un groupe cible`,
        );
      }
    }

    return erreurs.length === 0 ? { valide: true } : { valide: false, erreurs };
  }
}
