-- Additive uniquement : table enfant listant les années d'âge admises par
-- édition (docs/specs/ajoute-dans-les-parametres-dinscription-du-tournoi-les-annes.md).
-- La mise en NOT NULL de insc_joueurs_dossier.annee_naissance est volontairement
-- reportée à une migration séparée, une fois le backfill des dossiers existants
-- effectué (cf. track.md, section Arch).
CREATE TABLE IF NOT EXISTS `insc_edition_annees_age` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `edition_id` INT NOT NULL,
  `annee` INT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `insc_edition_annees_age_edition_id_annee_key` (`edition_id`, `annee`),
  CONSTRAINT `insc_edition_annees_age_edition_id_fkey` FOREIGN KEY (`edition_id`)
    REFERENCES `insc_editions` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4;
