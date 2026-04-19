CREATE TABLE `ta_cache_snapshots` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `snapshot_key` VARCHAR(64)  NOT NULL,
  `data`         LONGTEXT     NOT NULL,
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_snapshot_key` (`snapshot_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
