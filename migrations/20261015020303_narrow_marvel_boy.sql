ALTER TABLE `ingresso_city` RENAME TO `provider_city`;--> statement-breakpoint
ALTER TABLE `ingresso_theater` RENAME TO `provider_theater`;--> statement-breakpoint
ALTER TABLE `provider_city` ADD `provider` text NOT NULL DEFAULT 'ingresso';--> statement-breakpoint
ALTER TABLE `provider_theater` ADD `provider` text NOT NULL DEFAULT 'ingresso';--> statement-breakpoint
DROP INDEX IF EXISTS `ingresso_theater_cinema_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `ingresso_theater_synced_idx`;--> statement-breakpoint
CREATE INDEX `provider_theater_cinema_idx` ON `provider_theater` (`cinema_id`);--> statement-breakpoint
CREATE INDEX `provider_theater_synced_idx` ON `provider_theater` (`sessions_synced_at`);
