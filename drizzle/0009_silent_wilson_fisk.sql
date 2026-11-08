ALTER TABLE `site_content_versions` MODIFY COLUMN `contentJson` mediumtext NOT NULL;--> statement-breakpoint
ALTER TABLE `site_settings` MODIFY COLUMN `contentJson` mediumtext NOT NULL;