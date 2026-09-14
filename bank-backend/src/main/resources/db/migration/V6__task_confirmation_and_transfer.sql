-- Existing records are retained. Old tasks have no reception snapshot and are not training examples.
ALTER TABLE `task`
    ADD COLUMN `predicted_task_detail_type` VARCHAR(50) NULL,
    ADD COLUMN `confirmed_task_detail_type` VARCHAR(50) NULL,
    ADD COLUMN `confirmed_by` INT UNSIGNED NULL,
    ADD COLUMN `confirmed_at` DATETIME NULL,
    ADD COLUMN `feature_snapshot` JSON NULL,
    ADD COLUMN `feature_snapshot_at` DATETIME NULL,
    ADD COLUMN `transfer_count` INT NOT NULL DEFAULT 0,
    ADD COLUMN `last_transferred_at` DATETIME NULL;

UPDATE `task` SET predicted_task_detail_type = task_detail_type WHERE is_ai = 1;

CREATE TABLE `task_transfer_log` (
    `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `task_id` BIGINT NOT NULL,
    `from_member_id` INT UNSIGNED NULL,
    `to_member_id` INT UNSIGNED NOT NULL,
    `actor_member_id` INT UNSIGNED NULL,
    `actor_admin_id` INT UNSIGNED NULL,
    `previous_detail_type` VARCHAR(50) NOT NULL,
    `actual_detail_type` VARCHAR(50) NOT NULL,
    `reason` VARCHAR(1000) NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_transfer_task` (`task_id`),
    CONSTRAINT `fk_transfer_task` FOREIGN KEY (`task_id`) REFERENCES `task` (`task_id`)
);
