-- Hand-edited. drizzle-kit rebuilds `cinema`/`room` with PRAGMA foreign_keys=OFF,
-- which D1 ignores inside migrations, so DROP TABLE would cascade unpredictably.
-- Venue data is fully replaced by the ANCINE import (db/ancine/import.ts), so we
-- clear the hand-curated venues and their demo reviews and recreate both tables.
-- The resulting schema matches snapshot.json.
DELETE FROM `review`;--> statement-breakpoint
DROP TABLE `room`;--> statement-breakpoint
DROP TABLE `cinema`;--> statement-breakpoint
CREATE TABLE `cinema` (
	`id` text PRIMARY KEY,
	`ancine_id` text UNIQUE,
	`name` text NOT NULL,
	`chain` text NOT NULL,
	`city` text NOT NULL,
	`state` text NOT NULL,
	`neighborhood` text NOT NULL,
	`address` text NOT NULL,
	`cep` text,
	`website` text,
	`lat` real,
	`lng` real,
	`geo_precision` text
);
--> statement-breakpoint
CREATE TABLE `room` (
	`id` text PRIMARY KEY,
	`ancine_id` text UNIQUE,
	`cinema_id` text NOT NULL,
	`name` text NOT NULL,
	`format` text,
	`format_source` text,
	`projection` text,
	`projection_source` text,
	`sound` text,
	`sound_source` text,
	`seats` integer NOT NULL,
	`wheelchair_seats` integer DEFAULT 0 NOT NULL,
	`reduced_mobility_seats` integer DEFAULT 0 NOT NULL,
	`large_seats` integer DEFAULT 0 NOT NULL,
	`accessible_restroom` integer DEFAULT false NOT NULL,
	`accessible` integer NOT NULL,
	`search_text` text NOT NULL,
	CONSTRAINT `fk_room_cinema_id_cinema_id_fk` FOREIGN KEY (`cinema_id`) REFERENCES `cinema`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `room_fact` (
	`id` text PRIMARY KEY,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`field` text NOT NULL,
	`value` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_room_fact_room_id_room_id_fk` FOREIGN KEY (`room_id`) REFERENCES `room`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_room_fact_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `cinema_city_idx` ON `cinema` (`city`);--> statement-breakpoint
CREATE INDEX `cinema_state_idx` ON `cinema` (`state`);--> statement-breakpoint
CREATE INDEX `room_cinema_id_idx` ON `room` (`cinema_id`);--> statement-breakpoint
CREATE INDEX `room_format_idx` ON `room` (`format`);--> statement-breakpoint
CREATE UNIQUE INDEX `room_fact_one_vote_idx` ON `room_fact` (`user_id`,`room_id`,`field`);--> statement-breakpoint
CREATE INDEX `room_fact_room_field_idx` ON `room_fact` (`room_id`,`field`);
