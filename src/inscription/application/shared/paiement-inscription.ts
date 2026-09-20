export const STATUTS_FRAIS_INSCRIPTION_PAYE: readonly string[] = [
  'VALIDEE',
  'DOSSIER_EN_COURS',
  'DOSSIER_COMPLET',
];

export interface PaiementInscription {
  nbJoueurs: number;
  fraisInscriptionPaye: boolean;
  repasPaiementRecu: boolean;
}

export function derivePaiementInscription(inscription: {
  statut: string;
  dossier?: { repasPaiementRecu: boolean; joueurs: readonly unknown[] } | null;
}): PaiementInscription {
  return {
    nbJoueurs: inscription.dossier?.joueurs.length ?? 0,
    fraisInscriptionPaye: STATUTS_FRAIS_INSCRIPTION_PAYE.includes(inscription.statut),
    repasPaiementRecu: inscription.dossier?.repasPaiementRecu ?? false,
  };
}
