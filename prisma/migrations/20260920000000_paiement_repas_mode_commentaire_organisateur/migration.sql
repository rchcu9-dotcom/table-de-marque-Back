-- Paiement des repas : mode de règlement (virement / chèque / autre). La date saisie
-- par l'organisateur est stockée dans la colonne existante `date_paiement_repas`.
ALTER TABLE `insc_dossiers`
  ADD COLUMN `repas_mode_paiement` ENUM('VIREMENT', 'CHEQUE', 'AUTRE') NULL;

-- Commentaire libre par équipe, visible uniquement côté organisateur.
ALTER TABLE `insc_inscriptions`
  ADD COLUMN `commentaire_organisateur` TEXT NULL;
