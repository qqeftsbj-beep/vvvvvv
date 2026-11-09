CREATE TABLE `owner_editor_drafts` (
	`id` int NOT NULL,
	`contentJson` mediumtext NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `owner_editor_drafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `page_media_files` (
	`id` varchar(36) NOT NULL,
	`pageId` varchar(128) NOT NULL,
	`name` varchar(255) NOT NULL,
	`originalName` varchar(255) NOT NULL,
	`folder` varchar(160) NOT NULL DEFAULT '',
	`description` text NOT NULL,
	`mimeType` varchar(255) NOT NULL,
	`size` int NOT NULL,
	`key` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `page_media_files_id` PRIMARY KEY(`id`)
);
