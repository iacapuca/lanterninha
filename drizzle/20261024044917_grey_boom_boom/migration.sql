CREATE TABLE `follow` (
	`id` text PRIMARY KEY,
	`follower_id` text NOT NULL,
	`following_id` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_follow_follower_id_user_id_fk` FOREIGN KEY (`follower_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_follow_following_id_user_id_fk` FOREIGN KEY (`following_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `review_helpful` (
	`id` text PRIMARY KEY,
	`review_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_review_helpful_review_id_review_id_fk` FOREIGN KEY (`review_id`) REFERENCES `review`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_review_helpful_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `follow_pair_idx` ON `follow` (`follower_id`,`following_id`);--> statement-breakpoint
CREATE INDEX `follow_following_idx` ON `follow` (`following_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `review_helpful_one_vote_idx` ON `review_helpful` (`review_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `review_helpful_user_idx` ON `review_helpful` (`user_id`);