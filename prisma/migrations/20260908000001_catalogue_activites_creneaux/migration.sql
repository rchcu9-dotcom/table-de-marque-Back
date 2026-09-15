-- Migration: catalogue_activites_creneaux
-- Created: 2026-09-08
-- Feature: Catalogue d'Activités génériques + Créneaux d'activité manuels
-- (remplace PlanningActiviteType figé REPAS/CHALLENGE et les deux moteurs de
-- génération automatique de créneaux — cf. docs/specs/title-catalogue-...md)
--
-- Raw SQL, appliquée à la main (cf. décision 1788501923813 / migration
-- planning_activite_placeholder : `prisma migrate dev/deploy` inutilisable
-- sur ce projet). Idempotent où possible (IF NOT EXISTS / IF EXISTS,
-- MySQL 8+).
--
-- Décision de migration des données existantes (§2.7 de la spec, journalisée
-- dans decisions.json id 1788896095209, passe Architecte) :
--   - nb_patinoires = nb_patinoires_gg + nb_patinoires_pg
--   - chaque édition reçoit 2 lignes de catalogue (Repas / Challenge),
--     reprenant les durées existantes de l'édition
--   - les planning_activites déjà confirmés sont convertis en
--     planning_creneaux_activite (statut CONFIRME) plutôt que supprimés

-- 1. Nouvelles tables du catalogue et des créneaux -----------------------

CREATE TABLE IF NOT EXISTS `planning_activites_catalogue` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `edition_id` INTEGER NOT NULL,
  `label` VARCHAR(100) NOT NULL,
  `duree_par_equipe_min` INTEGER NOT NULL,
  `capacite_parallele` INTEGER NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `planning_activites_catalogue_edition_id_fkey`
    FOREIGN KEY (`edition_id`) REFERENCES `insc_editions` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `planning_creneaux_activite` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `edition_id` INTEGER NOT NULL,
  `activite_id` INTEGER NOT NULL,
  `date` DATE NOT NULL,
  `heure_debut` DATETIME(3) NOT NULL,
  `duree_min` INTEGER NOT NULL,
  `equipe_id` INTEGER NULL,
  `equipe_label` VARCHAR(100) NULL,
  `statut` ENUM('LIBRE', 'CONFIRME') NOT NULL DEFAULT 'LIBRE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `planning_creneaux_activite_edition_id_fkey`
    FOREIGN KEY (`edition_id`) REFERENCES `insc_editions` (`id`),
  CONSTRAINT `planning_creneaux_activite_activite_id_fkey`
    FOREIGN KEY (`activite_id`) REFERENCES `planning_activites_catalogue` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. nb_patinoires = somme des deux pools existants (patinoires physiques
--    distinctes avant cette feature, désormais un seul pool interchangeable)

ALTER TABLE `insc_editions`
  ADD COLUMN IF NOT EXISTS `nb_patinoires` INTEGER NULL;

UPDATE `insc_editions`
SET `nb_patinoires` = COALESCE(`nb_patinoires_gg`, 0) + COALESCE(`nb_patinoires_pg`, 0)
WHERE `nb_patinoires_gg` IS NOT NULL OR `nb_patinoires_pg` IS NOT NULL;

-- 3. Seed du catalogue Repas/Challenge pour chaque édition existante,
--    à partir des durées jusqu'ici en dur sur l'édition.

INSERT INTO `planning_activites_catalogue`
  (`edition_id`, `label`, `duree_par_equipe_min`, `capacite_parallele`, `created_at`)
SELECT `id`, 'Repas', COALESCE(`duree_repas_min`, 40), 4, NOW(3)
FROM `insc_editions`;

INSERT INTO `planning_activites_catalogue`
  (`edition_id`, `label`, `duree_par_equipe_min`, `capacite_parallele`, `created_at`)
SELECT `id`, 'Challenge', COALESCE(`duree_challenge_par_equipe_min`, 40), 1, NOW(3)
FROM `insc_editions`;

-- 4. Conversion des planning_activites déjà confirmés en créneaux manuels
--    (une ligne d'affectation équipe↔créneau déjà calculée devient une ligne
--    CreneauActivite CONFIRME — le planning déjà construit n'est pas perdu).

INSERT INTO `planning_creneaux_activite`
  (`edition_id`, `activite_id`, `date`, `heure_debut`, `duree_min`, `equipe_id`, `equipe_label`, `statut`, `created_at`)
SELECT
  pa.`edition_id`,
  cat.`id`,
  DATE(pa.`debut`),
  pa.`debut`,
  TIMESTAMPDIFF(MINUTE, pa.`debut`, pa.`fin`),
  pa.`equipe_id`,
  pa.`equipe_label`,
  'CONFIRME',
  pa.`created_at`
FROM `planning_activites` pa
JOIN `planning_activites_catalogue` cat
  ON cat.`edition_id` = pa.`edition_id`
  AND cat.`label` = (CASE pa.`type` WHEN 'REPAS' THEN 'Repas' ELSE 'Challenge' END)
WHERE pa.`statut` = 'CONFIRME';

-- 5. Nettoyage : ancienne table et anciennes colonnes figées.

DROP TABLE IF EXISTS `planning_activites`;

ALTER TABLE `insc_editions`
  DROP COLUMN IF EXISTS `duree_challenge_par_equipe_min`,
  DROP COLUMN IF EXISTS `duree_repas_min`,
  DROP COLUMN IF EXISTS `nb_patinoires_gg`,
  DROP COLUMN IF EXISTS `nb_patinoires_pg`;
