ALTER TABLE `insc_editions`
  ADD COLUMN IF NOT EXISTS `image_rib_data` MEDIUMBLOB NULL,
  ADD COLUMN IF NOT EXISTS `image_rib_mime_type` VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS `image_rib_updated_at` DATETIME NULL;
