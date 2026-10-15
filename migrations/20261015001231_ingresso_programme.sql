CREATE TABLE `film` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`original_title` text,
	`ancine_id` text,
	`duration_minutes` integer,
	`content_rating` text,
	`release_year` integer,
	`genres` text DEFAULT '[]' NOT NULL,
	`poster_url` text,
	`site_url` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ingresso_city` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`state` text NOT NULL,
	`theaters_synced_at` integer
);
--> statement-breakpoint
CREATE TABLE `ingresso_theater` (
	`id` text PRIMARY KEY,
	`city_id` text NOT NULL,
	`cinema_id` text,
	`matched_by` text,
	`name` text NOT NULL,
	`cnpj` text,
	`lat` real,
	`lng` real,
	`site_url` text,
	`sessions_synced_at` integer,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_ingresso_theater_cinema_id_cinema_id_fk` FOREIGN KEY (`cinema_id`) REFERENCES `cinema`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `showtime` (
	`id` text PRIMARY KEY,
	`theater_id` text NOT NULL,
	`cinema_id` text NOT NULL,
	`room_id` text,
	`film_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`room_name` text NOT NULL,
	`types` text DEFAULT '[]' NOT NULL,
	`price` real,
	`checkout_url` text,
	CONSTRAINT `fk_showtime_theater_id_ingresso_theater_id_fk` FOREIGN KEY (`theater_id`) REFERENCES `ingresso_theater`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_showtime_cinema_id_cinema_id_fk` FOREIGN KEY (`cinema_id`) REFERENCES `cinema`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_showtime_room_id_room_id_fk` FOREIGN KEY (`room_id`) REFERENCES `room`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_showtime_film_id_film_id_fk` FOREIGN KEY (`film_id`) REFERENCES `film`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `cinema` ADD `cnpj` text;--> statement-breakpoint
CREATE INDEX `cinema_cnpj_idx` ON `cinema` (`cnpj`);--> statement-breakpoint
CREATE INDEX `ingresso_theater_cinema_idx` ON `ingresso_theater` (`cinema_id`);--> statement-breakpoint
CREATE INDEX `ingresso_theater_synced_idx` ON `ingresso_theater` (`sessions_synced_at`);--> statement-breakpoint
CREATE INDEX `showtime_room_starts_idx` ON `showtime` (`room_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `showtime_cinema_starts_idx` ON `showtime` (`cinema_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `showtime_starts_idx` ON `showtime` (`starts_at`);--> statement-breakpoint
CREATE INDEX `showtime_theater_starts_idx` ON `showtime` (`theater_id`,`starts_at`);