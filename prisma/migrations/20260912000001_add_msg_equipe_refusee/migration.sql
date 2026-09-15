-- Migration: add_msg_equipe_refusee
-- Created: 2026-09-12
-- Feature: ajout du champ Edition.msgEquipeRefusee, personnalisable par
-- l'organisateur, pour remplacer le texte en dur affiché sur InscriptionPage
-- quand une candidature passe au statut REFUSEE
-- (cf. docs/specs/ajouter-dans-message-parcours-inscription-un-champequipe-ref.md).
--
-- Raw SQL, appliquée à la main (cf. décision 1788501923813 : `prisma migrate
-- dev/deploy` inutilisable sur ce projet). Additive et idempotente (IF NOT
-- EXISTS, MySQL 8+) — aucune donnée existante modifiée.

ALTER TABLE `insc_editions`
  ADD COLUMN IF NOT EXISTS `msg_equipe_refusee` TEXT NULL AFTER `msg_demande_soumise`;
