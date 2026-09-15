-- Migration: planning_activite_placeholder
-- Created: 2026-09-06
-- Feature: Étendre le placement repas à des identités placeholder ("1er Poule A")
--
-- Raw SQL, idempotent (cf. décision D8 de la spec table de marque / décision
-- 1788501923813 : l'outillage `prisma migrate dev/deploy` est inutilisable sur
-- ce projet — migration_lock.toml déclare sqlite, aucune base n'a de table
-- _prisma_migrations).
--
-- ATTENTION avant exécution en production : vérifier l'absence de doublons
-- existants sur (edition_id, jour, type, equipe_id) dans `planning_activites`
-- (aucun index d'unicité n'existait avant cette migration) — dédupliquer
-- sinon les ADD UNIQUE INDEX ci-dessous échoueront.

ALTER TABLE `planning_activites`
  MODIFY COLUMN `equipe_id` INTEGER NULL,
  ADD COLUMN IF NOT EXISTS `equipe_label` VARCHAR(100) NULL;

ALTER TABLE `planning_activites`
  ADD UNIQUE INDEX IF NOT EXISTS `planning_activites_edition_id_jour_type_equipe_id_key` (`edition_id`, `jour`, `type`, `equipe_id`),
  ADD UNIQUE INDEX IF NOT EXISTS `planning_activites_edition_id_jour_type_equipe_label_key` (`edition_id`, `jour`, `type`, `equipe_label`);
