CREATE TABLE `template_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tool` varchar(32) NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(160) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isVisible` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `template_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `template_categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `shared_templates` ADD `category` varchar(160) DEFAULT 'other' NOT NULL;