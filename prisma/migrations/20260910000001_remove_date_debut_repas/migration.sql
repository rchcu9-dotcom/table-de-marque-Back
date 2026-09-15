-- Migration: remove_date_debut_repas
-- Created: 2026-09-10
-- Feature: retrait du champ orphelin InscEdition.dateDbutRepas ("Début des repas")
-- (cf. docs/specs/corriger-libelles-edition-dates-et-retirer-contraintes-datefinfin.md
-- et decisions.json — champ persisté mais jamais lu par aucun usecase pour une
-- logique métier, confirmé par grep exhaustif sur back/ avant suppression).
--
-- Raw SQL, appliquée à la main (cf. décision 1788501923813 : `prisma migrate
-- dev/deploy` inutilisable sur ce projet). Idempotent (IF EXISTS, MySQL 8+).

ALTER TABLE `insc_editions`
  DROP COLUMN IF EXISTS `date_debut_repas`;
