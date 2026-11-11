CREATE TABLE `photo_report` (
	`id` text PRIMARY KEY,
	`photo_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_photo_report_photo_id_seat_photo_id_fk` FOREIGN KEY (`photo_id`) REFERENCES `seat_photo`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_photo_report_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `seat_photo` (
	`id` text PRIMARY KEY,
	`review_id` text NOT NULL UNIQUE,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`content_type` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`status` text DEFAULT 'visible' NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_seat_photo_review_id_review_id_fk` FOREIGN KEY (`review_id`) REFERENCES `review`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_seat_photo_room_id_room_id_fk` FOREIGN KEY (`room_id`) REFERENCES `room`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_seat_photo_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `review` ADD `seat_position` text;--> statement-breakpoint
ALTER TABLE `user` ADD `is_admin` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `photo_report_one_per_user_idx` ON `photo_report` (`photo_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `seat_photo_room_idx` ON `seat_photo` (`room_id`,`status`);--> statement-breakpoint
CREATE INDEX `seat_photo_status_idx` ON `seat_photo` (`status`);