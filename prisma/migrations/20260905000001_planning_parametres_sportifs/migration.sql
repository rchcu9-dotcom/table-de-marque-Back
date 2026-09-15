-- Migration: planning_parametres_sportifs
-- Created: 2026-09-05
-- Feature: Paramètres sportifs & génération du planning de tournoi
--
-- Raw SQL, idempotent (cf. décision D8 de la spec table de marque : l'outillage
-- `prisma migrate dev/deploy` est inutilisable pour ce projet — migration_lock.toml
-- déclare sqlite, aucune base n'a de table _prisma_migrations).

-- Extension InscEdition : durées/délais/patinoires + format de compétition
ALTER TABLE `insc_editions`
  ADD COLUMN IF NOT EXISTS `duree_inter_match_min` INTEGER NULL,
  ADD COLUMN IF NOT EXISTS `duree_challenge_par_equipe_min` INTEGER NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS `duree_repas_min` INTEGER NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS `delai_min_activite` JSON NULL,
  ADD COLUMN IF NOT EXISTS `nb_patinoires_gg` INTEGER NULL,
  ADD COLUMN IF NOT EXISTS `nb_patinoires_pg` INTEGER NULL,
  ADD COLUMN IF NOT EXISTS `nb_poules` INTEGER NULL,
  ADD COLUMN IF NOT EXISTS `nb_equipes_par_poule` INTEGER NULL,
  ADD COLUMN IF NOT EXISTS `nb_equipes_qualifiees_par_poule` INTEGER NULL,
  ADD COLUMN IF NOT EXISTS `format_phase_finale` ENUM('ELIMINATION_DIRECTE','POULES_FINALES','CLASSEMENT_CROISE') NULL,
  ADD COLUMN IF NOT EXISTS `regles_tie_break` JSON NULL;

-- Jours de compétition
CREATE TABLE IF NOT EXISTS `insc_edition_jours` (
  `id`            INTEGER      NOT NULL AUTO_INCREMENT,
  `edition_id`    INTEGER      NOT NULL,
  `numero_jour`   INTEGER      NOT NULL,
  `date`          DATE         NOT NULL,
  `heure_debut`   DATETIME(3)  NOT NULL,
  `heure_fin`     DATETIME(3)  NOT NULL,
  `type_journee`  VARCHAR(10)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `insc_edition_jours_edition_id_numero_jour_key` (`edition_id`, `numero_jour`),
  CONSTRAINT `insc_edition_jours_edition_id_fkey`
    FOREIGN KEY (`edition_id`) REFERENCES `insc_editions`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Activités planifiées (repas/challenge) — source de vérité, pas un cache dérivé
CREATE TABLE IF NOT EXISTS `planning_activites` (
  `id`         INTEGER      NOT NULL AUTO_INCREMENT,
  `edition_id` INTEGER      NOT NULL,
  `jour`       INTEGER      NOT NULL,
  `equipe_id`  INTEGER      NOT NULL,
  `type`       ENUM('REPAS','CHALLENGE') NOT NULL,
  `debut`      DATETIME(3)  NOT NULL,
  `fin`        DATETIME(3)  NOT NULL,
  `statut`     ENUM('PROPOSE','CONFIRME') NOT NULL DEFAULT 'PROPOSE',
  `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `planning_activites_edition_id_fkey`
    FOREIGN KEY (`edition_id`) REFERENCES `insc_editions`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Audit trail des confirmations (D11 : seule porte d'écriture sur TA_MATCHS, traçabilité)
CREATE TABLE IF NOT EXISTS `planning_confirmations` (
  `id`                       INTEGER      NOT NULL AUTO_INCREMENT,
  `edition_id`               INTEGER      NOT NULL,
  `confirmed_at`             DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `nb_matchs_crees`          INTEGER      NOT NULL,
  `nb_activites_crees`       INTEGER      NOT NULL,
  `forcage_equipes_fictives` TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  CONSTRAINT `planning_confirmations_edition_id_fkey`
    FOREIGN KEY (`edition_id`) REFERENCES `insc_editions`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
