CREATE TABLE `creative_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectName` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`imageUrls` text,
	`imageKeys` text,
	`link` text,
	`contact` varchar(500),
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`isVisible` int NOT NULL DEFAULT 0,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `creative_submissions_id` PRIMARY KEY(`id`)
);
