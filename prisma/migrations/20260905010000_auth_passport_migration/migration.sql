ALTER TABLE `insc_utilisateurs`
  CHANGE COLUMN `firebase_uid` `provider_uid` VARCHAR(128) NOT NULL;
ALTER TABLE `insc_utilisateurs`
  ADD COLUMN IF NOT EXISTS `provider` VARCHAR(20) NOT NULL DEFAULT 'google';
