CREATE TABLE `image_preview_cache` (
	`cacheKey` varchar(96) NOT NULL,
	`storageKey` text NOT NULL,
	`createdAt` bigint NOT NULL,
	CONSTRAINT `image_preview_cache_cacheKey` PRIMARY KEY(`cacheKey`)
);
--> statement-breakpoint
CREATE TABLE `shared_content_items` (
	`kind` varchar(32) NOT NULL,
	`entityId` varchar(128) NOT NULL,
	`tool` varchar(32),
	`category` varchar(160),
	`status` varchar(32) NOT NULL DEFAULT 'published',
	`reviewState` varchar(32),
	`visibility` int NOT NULL DEFAULT 1,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` timestamp,
	`searchText` varchar(512) NOT NULL,
	`payloadJson` mediumtext NOT NULL,
	CONSTRAINT `shared_content_items_pk` PRIMARY KEY(`kind`,`entityId`)
);
--> statement-breakpoint
CREATE TABLE `shared_content_state` (
	`id` int NOT NULL,
	`revision` int NOT NULL DEFAULT 1,
	`seeded` int NOT NULL DEFAULT 0,
	`nextIdsJson` mediumtext NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shared_content_state_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `shared_content_kind_page_idx` ON `shared_content_items` (`kind`,`visibility`,`status`,`reviewState`,`sortOrder`,`createdAt`);--> statement-breakpoint
CREATE INDEX `shared_content_category_page_idx` ON `shared_content_items` (`kind`,`category`,`visibility`,`sortOrder`,`createdAt`);--> statement-breakpoint
CREATE INDEX `shared_content_tool_page_idx` ON `shared_content_items` (`kind`,`tool`,`category`,`visibility`,`sortOrder`,`createdAt`);--> statement-breakpoint
CREATE INDEX `shared_content_deleted_idx` ON `shared_content_items` (`kind`,`deletedAt`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `shared_content_search_idx` ON `shared_content_items` (`kind`,`searchText`);