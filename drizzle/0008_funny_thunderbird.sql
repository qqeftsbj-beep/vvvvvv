CREATE TABLE `site_content_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contentJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `site_content_versions_id` PRIMARY KEY(`id`)
);
