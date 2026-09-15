CREATE TABLE IF NOT EXISTS `presentation_articles` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `groupe` VARCHAR(100) NOT NULL,
  `groupe_en` VARCHAR(100) NOT NULL,
  `titre` VARCHAR(150) NOT NULL,
  `titre_en` VARCHAR(150) NOT NULL,
  `description` TEXT NOT NULL,
  `description_en` TEXT NOT NULL,
  `image_url` VARCHAR(500) NULL,
  `lien_url` VARCHAR(500) NULL,
  `lieu` VARCHAR(255) NULL,
  `maps_query` VARCHAR(255) NULL,
  `ordre` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;
