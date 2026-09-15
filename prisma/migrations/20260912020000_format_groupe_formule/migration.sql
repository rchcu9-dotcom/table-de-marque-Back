-- Migration: format_groupe_formule
-- Created: 2026-09-12
-- Feature: ajout de la formule (Championnat / Ronde suisse) configurable par
-- groupe de 3 places ou plus dans le générateur de compétition
-- (cf. docs/specs/dans-le-generateur-de-comptition-quand-un-groupe-a-plus-de-2.md).
--
-- Raw SQL, appliquée à la main (cf. décision 1788501923813 : `prisma migrate
-- dev/deploy` inutilisable sur ce projet). Additive et idempotente (IF NOT
-- EXISTS, MySQL 8+) — tous les groupes existants héritent du défaut
-- 'CHAMPIONNAT', aucun changement de comportement pour les compétitions déjà
-- configurées.

ALTER TABLE `format_groupes`
  ADD COLUMN IF NOT EXISTS `formule` ENUM('CHAMPIONNAT','RONDE_SUISSE') NOT NULL DEFAULT 'CHAMPIONNAT' AFTER `ordre`;
