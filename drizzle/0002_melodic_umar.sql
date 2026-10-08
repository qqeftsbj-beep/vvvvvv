CREATE TABLE `template_settings` (
	`id` int NOT NULL,
	`retentionDays` int NOT NULL DEFAULT 30,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `template_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `shared_templates` ADD `deletedAt` timestamp;