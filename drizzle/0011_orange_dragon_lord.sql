CREATE TABLE `management_backups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` varchar(64) NOT NULL,
	`size` int NOT NULL,
	`contentJson` mediumtext NOT NULL,
	`collectionsJson` mediumtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `management_backups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `management_trash` (
	`id` varchar(80) NOT NULL,
	`kind` varchar(80) NOT NULL,
	`title` varchar(255) NOT NULL,
	`source` varchar(255) NOT NULL,
	`deletedAt` timestamp NOT NULL DEFAULT (now()),
	`parentId` varchar(128),
	`itemIndex` int,
	`valueJson` mediumtext NOT NULL,
	`workspaceRevision` int NOT NULL,
	CONSTRAINT `management_trash_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `management_workspaces` (
	`id` int NOT NULL,
	`workingContentJson` mediumtext NOT NULL,
	`workingCollectionsJson` mediumtext NOT NULL,
	`publishedContentJson` mediumtext NOT NULL,
	`publishedCollectionsJson` mediumtext NOT NULL,
	`revision` int NOT NULL DEFAULT 1,
	`publishedRevision` int NOT NULL DEFAULT 1,
	`savedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `management_workspaces_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `creative_submissions` ADD `reviewState` enum('inbox','saved','waiting','cancelled') DEFAULT 'inbox' NOT NULL;