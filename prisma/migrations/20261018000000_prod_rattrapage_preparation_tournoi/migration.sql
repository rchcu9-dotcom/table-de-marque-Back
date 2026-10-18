-- Rattrapage de la base de PRODUCTION (rchcu11_tournoi) sur schema.prisma, et
-- passage de la prod en mode « Préparation tournoi » (cycle annuel de l'édition,
-- docs/specs/title-cycle-annuel-de-ldition-dump-obligatoire-prparation-de.md).
--
-- Constat du 2026-10-18 (prisma migrate diff prod → schema.prisma) : la prod n'a
-- aucune des tables insc_* / planning_* / format_* / presentation_articles, qui
-- n'ont jamais été créées par une migration versionnée (créées à la main sur la
-- base de test). Les tables TA_*, match_* et ta_partenaires existent déjà.
--
-- Strictement additif : aucun DROP/ALTER de colonne existante. Les écarts
-- historiques de la prod (types VARCHAR(50) vs 191, colonnes REPAS_* /
-- CHALLENGE_SAMEDI / PHOTO de ta_equipes, tables ta_partenaires / ta_users) sont
-- volontairement conservés : le back de prod (main) les lit encore.
--
-- Idempotent et sans effet sur une base déjà à jour (la base de test : toutes
-- les tables existent, les éditions aussi → chaque INSERT est gardé par un
-- NOT EXISTS). Les données d'amorçage sont lues dans rchcu11_tournoi_test
-- (même serveur AlwaysData, même utilisateur) : à exécuter via
-- scripts/prod-bascule/bascule-prod.ts, qui fait le dump préalable des TA_*.
--
-- Syntaxe MariaDB (10.11 sur AlwaysData) : FOREIGN KEY IF NOT EXISTS.

-- ── 1. Tables ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `insc_utilisateurs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `provider_uid` VARCHAR(128) NOT NULL,
    `provider` VARCHAR(20) NOT NULL DEFAULT 'google',
    `email` VARCHAR(255) NOT NULL,
    `display_name` VARCHAR(255) NULL,
    `pseudo` VARCHAR(50) NULL,
    `role` ENUM('RESPONSABLE_EQUIPE', 'ORGANISATEUR', 'TABLE_DE_MARQUE') NOT NULL DEFAULT 'RESPONSABLE_EQUIPE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `insc_utilisateurs_provider_uid_key`(`provider_uid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `insc_editions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nom` VARCHAR(100) NOT NULL,
    `categorie` VARCHAR(20) NOT NULL,
    `annee` INTEGER NOT NULL,
    `etape` VARCHAR(30) NOT NULL DEFAULT 'CREEE',
    `date_debut` DATETIME(3) NOT NULL,
    `date_fin_debut` DATETIME(3) NOT NULL,
    `date_fin_fin` DATETIME(3) NULL,
    `frais_inscription` DECIMAL(8, 2) NOT NULL,
    `prix_repas` DECIMAL(8, 2) NOT NULL,
    `nb_places_max` INTEGER NOT NULL DEFAULT 16,
    `image_url` VARCHAR(500) NULL,
    `image_dossier_url` VARCHAR(500) NULL,
    `image_rib_url` VARCHAR(500) NULL,
    `image_rib_data` MEDIUMBLOB NULL,
    `image_rib_mime_type` VARCHAR(100) NULL,
    `image_rib_updated_at` DATETIME(3) NULL,
    `contact_email` VARCHAR(255) NULL,
    `contact_phone` VARCHAR(30) NULL,
    `duree_surfacage_min` INTEGER NOT NULL DEFAULT 20,
    `duree_match_poule_min` INTEGER NOT NULL DEFAULT 27,
    `duree_match_final_min` INTEGER NOT NULL DEFAULT 33,
    `affichage_planning_public` BOOLEAN NOT NULL DEFAULT false,
    `msg_bienvenue` TEXT NULL,
    `msg_faisons_connaissance` TEXT NULL,
    `msg_selection_equipe` TEXT NULL,
    `msg_ajout_equipe` TEXT NULL,
    `msg_inscription_en_cours` TEXT NULL,
    `msg_inscription_validee_autre` TEXT NULL,
    `msg_lancer_demande` TEXT NULL,
    `msg_demande_soumise` TEXT NULL,
    `msg_equipe_refusee` TEXT NULL,
    `msg_liste_attente` TEXT NULL,
    `msg_paiement_attendu` TEXT NULL,
    `msg_cheque_info_1` TEXT NULL,
    `msg_cheque_info_2` TEXT NULL,
    `msg_inscription_confirmee` TEXT NULL,
    `msg_renseigne_joueurs` TEXT NULL,
    `duree_inter_match_min` INTEGER NULL,
    `delai_min_activite` JSON NULL,
    `nb_patinoires` INTEGER NULL,
    `nb_poules` INTEGER NULL,
    `nb_equipes_par_poule` INTEGER NULL,
    `nb_equipes_qualifiees_par_poule` INTEGER NULL,
    `format_phase_finale` ENUM('ELIMINATION_DIRECTE', 'POULES_FINALES', 'CLASSEMENT_CROISE') NULL,
    `regles_tie_break` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `insc_edition_annees_age` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `edition_id` INTEGER NOT NULL,
    `annee` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `insc_edition_annees_age_edition_id_annee_key`(`edition_id`, `annee`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `insc_equipes_referentiel` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nom` VARCHAR(100) NOT NULL,
    `nom_complet` VARCHAR(150) NULL,
    `logo_url` VARCHAR(500) NULL,
    `active` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `insc_equipes_referentiel_nom_key`(`nom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `insc_inscriptions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `edition_id` INTEGER NOT NULL,
    `utilisateur_id` INTEGER NOT NULL,
    `equipe_ref_id` INTEGER NULL,
    `equipe_nom` VARCHAR(100) NOT NULL,
    `statut` ENUM('CANDIDATE', 'RESERVEE', 'LISTE_ATTENTE', 'PAIEMENT_ATTENDU', 'VALIDEE', 'DOSSIER_EN_COURS', 'DOSSIER_COMPLET', 'REFUSEE') NOT NULL DEFAULT 'CANDIDATE',
    `commentaire_organisateur` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `insc_inscriptions_edition_id_equipe_ref_id_key`(`edition_id`, `equipe_ref_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `insc_dossiers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `inscription_id` INTEGER NOT NULL,
    `date_virement_inscription` DATETIME(3) NULL,
    `date_reception_inscription` DATETIME(3) NULL,
    `date_paiement_repas` DATETIME(3) NULL,
    `date_reception_repas` DATETIME(3) NULL,
    `repas_paiement_recu` BOOLEAN NOT NULL DEFAULT false,
    `repas_mode_paiement` ENUM('VIREMENT', 'CHEQUE', 'AUTRE') NULL,
    `droits_image_acceptes` BOOLEAN NOT NULL DEFAULT false,
    `droits_image_horodatage` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `insc_dossiers_inscription_id_key`(`inscription_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `insc_joueurs_dossier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dossier_id` INTEGER NOT NULL,
    `nom` VARCHAR(100) NOT NULL,
    `prenom` VARCHAR(100) NOT NULL,
    `numero` INTEGER NOT NULL,
    `poste` VARCHAR(10) NOT NULL,
    `licence_ffh` VARCHAR(50) NULL,
    `annee_naissance` INTEGER NULL,
    `particularites_alim` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `insc_coachs_dossier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dossier_id` INTEGER NOT NULL,
    `nom` VARCHAR(100) NOT NULL,
    `prenom` VARCHAR(100) NOT NULL,
    `presence_repas` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `insc_edition_jours` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `edition_id` INTEGER NOT NULL,
    `numero_jour` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `heure_debut` DATETIME(3) NOT NULL,
    `heure_fin` DATETIME(3) NOT NULL,
    `type_journee` VARCHAR(10) NOT NULL,

    UNIQUE INDEX `insc_edition_jours_edition_id_numero_jour_key`(`edition_id`, `numero_jour`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `planning_activites_catalogue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `edition_id` INTEGER NOT NULL,
    `label` VARCHAR(100) NOT NULL,
    `duree_par_equipe_min` INTEGER NOT NULL,
    `capacite_parallele` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `planning_confirmations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `edition_id` INTEGER NOT NULL,
    `confirmed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `nb_matchs_crees` INTEGER NOT NULL,
    `nb_activites_crees` INTEGER NOT NULL,
    `forcage_equipes_fictives` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `planning_match_slots` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `edition_id` INTEGER NOT NULL,
    `num_match` INTEGER NOT NULL,
    `cote` INTEGER NOT NULL,
    `ref` VARCHAR(80) NOT NULL,
    `libelle_placeholder` VARCHAR(100) NOT NULL,
    `num_match_source` INTEGER NULL,
    `poule_code` VARCHAR(4) NULL,
    `rang_poule` INTEGER NULL,
    `role` ENUM('VAINQUEUR', 'PERDANT') NOT NULL DEFAULT 'VAINQUEUR',
    `resolu` BOOLEAN NOT NULL DEFAULT false,
    `equipe_id_resolu` INTEGER NULL,
    `equipe_nom_resolu` VARCHAR(100) NULL,
    `resolu_at` DATETIME(3) NULL,
    `resolu_manuellement` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `planning_match_slots_num_match_cote_key`(`num_match`, `cote`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `format_phases` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `edition_id` INTEGER NOT NULL,
    `nom` VARCHAR(60) NOT NULL,
    `ordre` INTEGER NOT NULL,

    UNIQUE INDEX `format_phases_edition_id_ordre_key`(`edition_id`, `ordre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `format_phase_jours` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `phase_id` INTEGER NOT NULL,
    `edition_jour_id` INTEGER NOT NULL,

    UNIQUE INDEX `format_phase_jours_phase_id_edition_jour_id_key`(`phase_id`, `edition_jour_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `format_groupes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `phase_id` INTEGER NOT NULL,
    `nom` VARCHAR(60) NOT NULL,
    `ordre` INTEGER NOT NULL,
    `formule` ENUM('CHAMPIONNAT', 'RONDE_SUISSE') NOT NULL DEFAULT 'CHAMPIONNAT',

    UNIQUE INDEX `format_groupes_phase_id_ordre_key`(`phase_id`, `ordre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `format_places` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `groupe_id` INTEGER NOT NULL,
    `position` INTEGER NOT NULL,
    `origine` ENUM('ALIAS', 'LIEE') NOT NULL,
    `alias_label` VARCHAR(60) NULL,

    UNIQUE INDEX `format_places_groupe_id_position_key`(`groupe_id`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `format_liens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `groupe_source_id` INTEGER NOT NULL,
    `rang_source` INTEGER NOT NULL,
    `etat` ENUM('NON_DEFINI', 'ELIMINE', 'LIE') NOT NULL DEFAULT 'NON_DEFINI',
    `groupe_cible_id` INTEGER NULL,
    `place_cible_id` INTEGER NULL,

    UNIQUE INDEX `format_liens_place_cible_id_key`(`place_cible_id`),
    UNIQUE INDEX `format_liens_groupe_source_id_rang_source_key`(`groupe_source_id`, `rang_source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `format_meta` (
    `edition_id` INTEGER NOT NULL,
    `genere_depuis_preset` ENUM('ELIMINATION_DIRECTE', 'POULES_FINALES', 'CLASSEMENT_CROISE') NULL,
    `modifie_manuellement` BOOLEAN NOT NULL DEFAULT false,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`edition_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `presentation_articles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `groupe` VARCHAR(100) NOT NULL,
    `groupe_en` VARCHAR(100) NOT NULL,
    `surtitre` VARCHAR(100) NOT NULL DEFAULT '',
    `surtitre_en` VARCHAR(100) NOT NULL DEFAULT '',
    `titre` VARCHAR(150) NOT NULL,
    `titre_en` VARCHAR(150) NOT NULL,
    `description` TEXT NOT NULL,
    `description_en` TEXT NOT NULL,
    `faits` TEXT NULL,
    `faits_en` TEXT NULL,
    `titre_accroche` VARCHAR(100) NOT NULL DEFAULT '',
    `titre_accroche_en` VARCHAR(100) NOT NULL DEFAULT '',
    `description_courte` VARCHAR(320) NOT NULL DEFAULT '',
    `description_courte_en` VARCHAR(320) NOT NULL DEFAULT '',
    `image_url` VARCHAR(500) NULL,
    `lien_url` VARCHAR(500) NULL,
    `lieu` VARCHAR(255) NULL,
    `maps_query` VARCHAR(255) NULL,
    `ordre` INTEGER NOT NULL DEFAULT 0,
    `groupe_ordre` INTEGER NOT NULL DEFAULT 0,
    `groupe_duree_ms` INTEGER NOT NULL DEFAULT 5000,
    `groupe_image_url` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- ── 2. Clés étrangères (dont ta_equipes.EQUIPE_REF_ID et match_buts/penalites → insc_joueurs_dossier) ──
ALTER TABLE `ta_equipes` ADD CONSTRAINT `ta_equipes_EQUIPE_REF_ID_fkey` FOREIGN KEY IF NOT EXISTS (`EQUIPE_REF_ID`) REFERENCES `insc_equipes_referentiel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `insc_edition_annees_age` ADD CONSTRAINT `insc_edition_annees_age_edition_id_fkey` FOREIGN KEY IF NOT EXISTS (`edition_id`) REFERENCES `insc_editions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `insc_inscriptions` ADD CONSTRAINT `insc_inscriptions_edition_id_fkey` FOREIGN KEY IF NOT EXISTS (`edition_id`) REFERENCES `insc_editions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `insc_inscriptions` ADD CONSTRAINT `insc_inscriptions_utilisateur_id_fkey` FOREIGN KEY IF NOT EXISTS (`utilisateur_id`) REFERENCES `insc_utilisateurs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `insc_inscriptions` ADD CONSTRAINT `insc_inscriptions_equipe_ref_id_fkey` FOREIGN KEY IF NOT EXISTS (`equipe_ref_id`) REFERENCES `insc_equipes_referentiel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `insc_dossiers` ADD CONSTRAINT `insc_dossiers_inscription_id_fkey` FOREIGN KEY IF NOT EXISTS (`inscription_id`) REFERENCES `insc_inscriptions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `insc_joueurs_dossier` ADD CONSTRAINT `insc_joueurs_dossier_dossier_id_fkey` FOREIGN KEY IF NOT EXISTS (`dossier_id`) REFERENCES `insc_dossiers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `insc_coachs_dossier` ADD CONSTRAINT `insc_coachs_dossier_dossier_id_fkey` FOREIGN KEY IF NOT EXISTS (`dossier_id`) REFERENCES `insc_dossiers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `match_buts` ADD CONSTRAINT `match_buts_buteur_id_fkey` FOREIGN KEY IF NOT EXISTS (`buteur_id`) REFERENCES `insc_joueurs_dossier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `match_buts` ADD CONSTRAINT `match_buts_assist1_id_fkey` FOREIGN KEY IF NOT EXISTS (`assist1_id`) REFERENCES `insc_joueurs_dossier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `match_buts` ADD CONSTRAINT `match_buts_assist2_id_fkey` FOREIGN KEY IF NOT EXISTS (`assist2_id`) REFERENCES `insc_joueurs_dossier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `match_penalites` ADD CONSTRAINT `match_penalites_joueur_id_fkey` FOREIGN KEY IF NOT EXISTS (`joueur_id`) REFERENCES `insc_joueurs_dossier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `insc_edition_jours` ADD CONSTRAINT `insc_edition_jours_edition_id_fkey` FOREIGN KEY IF NOT EXISTS (`edition_id`) REFERENCES `insc_editions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `planning_activites_catalogue` ADD CONSTRAINT `planning_activites_catalogue_edition_id_fkey` FOREIGN KEY IF NOT EXISTS (`edition_id`) REFERENCES `insc_editions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `planning_creneaux_activite` ADD CONSTRAINT `planning_creneaux_activite_edition_id_fkey` FOREIGN KEY IF NOT EXISTS (`edition_id`) REFERENCES `insc_editions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `planning_creneaux_activite` ADD CONSTRAINT `planning_creneaux_activite_activite_id_fkey` FOREIGN KEY IF NOT EXISTS (`activite_id`) REFERENCES `planning_activites_catalogue`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `planning_confirmations` ADD CONSTRAINT `planning_confirmations_edition_id_fkey` FOREIGN KEY IF NOT EXISTS (`edition_id`) REFERENCES `insc_editions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `planning_match_slots` ADD CONSTRAINT `planning_match_slots_edition_id_fkey` FOREIGN KEY IF NOT EXISTS (`edition_id`) REFERENCES `insc_editions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `format_phases` ADD CONSTRAINT `format_phases_edition_id_fkey` FOREIGN KEY IF NOT EXISTS (`edition_id`) REFERENCES `insc_editions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `format_phase_jours` ADD CONSTRAINT `format_phase_jours_phase_id_fkey` FOREIGN KEY IF NOT EXISTS (`phase_id`) REFERENCES `format_phases`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `format_phase_jours` ADD CONSTRAINT `format_phase_jours_edition_jour_id_fkey` FOREIGN KEY IF NOT EXISTS (`edition_jour_id`) REFERENCES `insc_edition_jours`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `format_groupes` ADD CONSTRAINT `format_groupes_phase_id_fkey` FOREIGN KEY IF NOT EXISTS (`phase_id`) REFERENCES `format_phases`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `format_places` ADD CONSTRAINT `format_places_groupe_id_fkey` FOREIGN KEY IF NOT EXISTS (`groupe_id`) REFERENCES `format_groupes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `format_liens` ADD CONSTRAINT `format_liens_groupe_source_id_fkey` FOREIGN KEY IF NOT EXISTS (`groupe_source_id`) REFERENCES `format_groupes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `format_liens` ADD CONSTRAINT `format_liens_place_cible_id_fkey` FOREIGN KEY IF NOT EXISTS (`place_cible_id`) REFERENCES `format_places`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `format_meta` ADD CONSTRAINT `format_meta_edition_id_fkey` FOREIGN KEY IF NOT EXISTS (`edition_id`) REFERENCES `insc_editions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 3. Données d'amorçage ───────────────────────────────────────────────────

-- 3a. Compte organisateur (Google) : sans lui, personne n'accède à l'admin.
INSERT INTO `insc_utilisateurs` (provider_uid, provider, email, display_name, pseudo, role, created_at, updated_at)
SELECT src.provider_uid, src.provider, src.email, src.display_name, src.pseudo, src.role, src.created_at, NOW(3)
  FROM `rchcu11_tournoi_test`.`insc_utilisateurs` src
 WHERE src.role = 'ORGANISATEUR' AND src.provider = 'google'
   AND NOT EXISTS (SELECT 1 FROM `insc_utilisateurs` u WHERE u.role = 'ORGANISATEUR');

-- 3b. Contenu de la page Présentation (articles saisis sur staging).
INSERT INTO `presentation_articles` (groupe, groupe_en, surtitre, surtitre_en, titre, titre_en, description, description_en, faits, faits_en, titre_accroche, titre_accroche_en, description_courte, description_courte_en, image_url, lien_url, lieu, maps_query, ordre, groupe_ordre, groupe_duree_ms, groupe_image_url, created_at, updated_at)
SELECT groupe, groupe_en, surtitre, surtitre_en, titre, titre_en, description, description_en, faits, faits_en, titre_accroche, titre_accroche_en, description_courte, description_courte_en, image_url, lien_url, lieu, maps_query, ordre, groupe_ordre, groupe_duree_ms, groupe_image_url, created_at, updated_at
  FROM `rchcu11_tournoi_test`.`presentation_articles` src
 WHERE NOT EXISTS (SELECT 1 FROM `presentation_articles` p)
 ORDER BY src.id;

-- 3c. Édition sortante 2026, figée à TOURNOI_DEMARRE : c'est elle que
-- getEditionActive() renvoie, donc l'affichage public reste celui des
-- résultats 2026 (TA_* inchangées). Dates réelles du tournoi : 23-25 mai 2026
-- (heure de Paris, stockées en UTC comme le fait Prisma).
INSERT INTO `insc_editions` (nom, categorie, annee, etape, date_debut, date_fin_debut, date_fin_fin,
  frais_inscription, prix_repas, nb_places_max, image_url, image_dossier_url, image_rib_url,
  contact_email, contact_phone, msg_bienvenue, msg_faisons_connaissance, msg_selection_equipe, msg_ajout_equipe, msg_inscription_en_cours, msg_inscription_validee_autre, msg_lancer_demande, msg_demande_soumise, msg_equipe_refusee, msg_liste_attente, msg_paiement_attendu, msg_cheque_info_1, msg_cheque_info_2, msg_inscription_confirmee, msg_renseigne_joueurs, created_at, updated_at)
SELECT 'Tournoi RCHC U11 2026', 'U11', 2026, 'TOURNOI_DEMARRE',
       '2026-05-22 22:00:00.000', '2026-05-25 21:59:59.000', NULL,
       src.frais_inscription, src.prix_repas, src.nb_places_max, src.image_url, src.image_dossier_url, src.image_rib_url,
       src.contact_email, src.contact_phone, msg_bienvenue, msg_faisons_connaissance, msg_selection_equipe, msg_ajout_equipe, msg_inscription_en_cours, msg_inscription_validee_autre, msg_lancer_demande, msg_demande_soumise, msg_equipe_refusee, msg_liste_attente, msg_paiement_attendu, msg_cheque_info_1, msg_cheque_info_2, msg_inscription_confirmee, msg_renseigne_joueurs,
       '2026-03-08 18:20:36.000', NOW(3)
  FROM `rchcu11_tournoi_test`.`insc_editions` src
 WHERE src.annee = 2026
   AND NOT EXISTS (SELECT 1 FROM `insc_editions` e)
 ORDER BY src.id
 LIMIT 1;

-- 3d. Édition entrante 2027 en CREATION_NOUVEAU_TOURNOI (« Préparation ») :
-- invisible du public, pilotée depuis l'admin (bloc « édition en préparation »).
-- Paramètres d'inscription repris de l'édition 2027 préparée sur staging ;
-- format sportif, jours, activités et créneaux laissés vides (à saisir en prod).
INSERT INTO `insc_editions` (nom, categorie, annee, etape, date_debut, date_fin_debut, date_fin_fin,
  frais_inscription, prix_repas, nb_places_max, image_url, image_dossier_url, image_rib_url,
  image_rib_data, image_rib_mime_type, image_rib_updated_at, contact_email, contact_phone,
  duree_surfacage_min, duree_match_poule_min, duree_match_final_min, affichage_planning_public,
  msg_bienvenue, msg_faisons_connaissance, msg_selection_equipe, msg_ajout_equipe, msg_inscription_en_cours, msg_inscription_validee_autre, msg_lancer_demande, msg_demande_soumise, msg_equipe_refusee, msg_liste_attente, msg_paiement_attendu, msg_cheque_info_1, msg_cheque_info_2, msg_inscription_confirmee, msg_renseigne_joueurs, created_at, updated_at)
SELECT src.nom, src.categorie, src.annee, 'CREATION_NOUVEAU_TOURNOI', src.date_debut, src.date_fin_debut, NULL,
       src.frais_inscription, src.prix_repas, src.nb_places_max, src.image_url, src.image_dossier_url, src.image_rib_url,
       src.image_rib_data, src.image_rib_mime_type, src.image_rib_updated_at, src.contact_email, src.contact_phone,
       src.duree_surfacage_min, src.duree_match_poule_min, src.duree_match_final_min, 0,
       msg_bienvenue, msg_faisons_connaissance, msg_selection_equipe, msg_ajout_equipe, msg_inscription_en_cours, msg_inscription_validee_autre, msg_lancer_demande, msg_demande_soumise, msg_equipe_refusee, msg_liste_attente, msg_paiement_attendu, msg_cheque_info_1, msg_cheque_info_2, msg_inscription_confirmee, msg_renseigne_joueurs, NOW(3), NOW(3)
  FROM `rchcu11_tournoi_test`.`insc_editions` src
 WHERE src.annee = 2027
   AND EXISTS (SELECT 1 FROM `insc_editions` e WHERE e.annee = 2026 AND e.etape = 'TOURNOI_DEMARRE')
   AND NOT EXISTS (SELECT 1 FROM `insc_editions` e WHERE e.annee = 2027)
 ORDER BY src.id
 LIMIT 1;

-- 3e. Années d'âge de l'édition en préparation.
INSERT INTO `insc_edition_annees_age` (edition_id, annee, created_at)
SELECT cible.id, a.annee, NOW(3)
  FROM `rchcu11_tournoi_test`.`insc_edition_annees_age` a
  JOIN `rchcu11_tournoi_test`.`insc_editions` src ON src.id = a.edition_id AND src.annee = 2027
  JOIN `insc_editions` cible ON cible.annee = 2027 AND cible.etape = 'CREATION_NOUVEAU_TOURNOI'
 WHERE NOT EXISTS (SELECT 1 FROM `insc_edition_annees_age` x WHERE x.edition_id = cible.id);
