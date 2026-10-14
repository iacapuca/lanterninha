CREATE TABLE `account` (
	`id` text PRIMARY KEY,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	CONSTRAINT `fk_account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `cinema` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`chain` text NOT NULL,
	`city` text NOT NULL,
	`state` text NOT NULL,
	`neighborhood` text NOT NULL,
	`address` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review` (
	`id` text PRIMARY KEY,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`rating` real NOT NULL,
	`picture` integer NOT NULL,
	`sound` integer NOT NULL,
	`comfort` integer NOT NULL,
	`cleanliness` integer NOT NULL,
	`row` text,
	`film` text,
	`body` text NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`day` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_review_room_id_room_id_fk` FOREIGN KEY (`room_id`) REFERENCES `room`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_review_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `room` (
	`id` text PRIMARY KEY,
	`cinema_id` text NOT NULL,
	`name` text NOT NULL,
	`format` text NOT NULL,
	`seats` integer NOT NULL,
	`projection` text NOT NULL,
	`sound` text NOT NULL,
	`accessible` integer NOT NULL,
	`search_text` text NOT NULL,
	CONSTRAINT `fk_room_cinema_id_cinema_id_fk` FOREIGN KEY (`cinema_id`) REFERENCES `cinema`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL UNIQUE,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	CONSTRAINT `fk_session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`username` text UNIQUE,
	`display_username` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `cinema_city_idx` ON `cinema` (`city`);--> statement-breakpoint
CREATE INDEX `cinema_state_idx` ON `cinema` (`state`);--> statement-breakpoint
CREATE INDEX `review_room_created_idx` ON `review` (`room_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `review_user_created_idx` ON `review` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `review_created_idx` ON `review` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `review_one_per_day_idx` ON `review` (`user_id`,`room_id`,`day`);--> statement-breakpoint
CREATE INDEX `room_cinema_id_idx` ON `room` (`cinema_id`);--> statement-breakpoint
CREATE INDEX `room_format_idx` ON `room` (`format`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);