-- Shared by direct reception (Spring) and AI reception (Python).
-- Increment and task insertion commit together. The date row serializes issuers.
CREATE TABLE `bank`.`task_ticket_sequence` (
    `ticket_date` DATE NOT NULL PRIMARY KEY,
    `last_number` BIGINT NOT NULL
) ENGINE=InnoDB;

-- Preserve every existing ticket. Continue any already-issued numeric series.
INSERT INTO `bank`.`task_ticket_sequence` (`ticket_date`, `last_number`)
SELECT DATE(`created_at`), MAX(CAST(`ticket_number` AS UNSIGNED))
FROM `bank`.`task`
WHERE `created_at` IS NOT NULL AND `ticket_number` REGEXP '^[0-9]+$'
GROUP BY DATE(`created_at`);
