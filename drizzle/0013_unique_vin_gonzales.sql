CREATE TABLE `customer_requests` (
	`id` varchar(128) NOT NULL,
	`name` varchar(150) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`request` mediumtext NOT NULL,
	`source` varchar(150) NOT NULL,
	`status` enum('new','contacted','completed') NOT NULL DEFAULT 'new',
	`createdAt` bigint NOT NULL,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `customer_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `owner_notification_preferences` (
	`id` int NOT NULL,
	`showSubmissions` int NOT NULL DEFAULT 1,
	`showRequests` int NOT NULL DEFAULT 1,
	`showToast` int NOT NULL DEFAULT 1,
	`updatedAt` bigint NOT NULL,
	CONSTRAINT `owner_notification_preferences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `owner_notification_reads` (
	`notificationKey` varchar(191) NOT NULL,
	`readAt` bigint NOT NULL,
	CONSTRAINT `owner_notification_reads_notificationKey` PRIMARY KEY(`notificationKey`)
);
--> statement-breakpoint
CREATE INDEX `customer_requests_created_at_idx` ON `customer_requests` (`createdAt`,`id`);--> statement-breakpoint
CREATE INDEX `customer_requests_status_created_at_idx` ON `customer_requests` (`status`,`createdAt`,`id`);--> statement-breakpoint
CREATE INDEX `customer_requests_name_idx` ON `customer_requests` (`name`);
--> statement-breakpoint
INSERT IGNORE INTO `owner_notification_reads` (`notificationKey`, `readAt`)
SELECT CONCAT('submission:', CAST(`id` AS CHAR)), CAST(UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000 AS UNSIGNED)
FROM `creative_submissions`;
