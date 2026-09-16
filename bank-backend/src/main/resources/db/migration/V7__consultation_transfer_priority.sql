-- Only new consultation transfers receive priority. Existing reception times remain intact.
ALTER TABLE `task`
    ADD COLUMN `priority_transferred_at` DATETIME(6) NULL,
    ADD INDEX `idx_task_member_queue` (`member_id`, `status`, `priority_transferred_at`, `created_at`, `task_id`);
