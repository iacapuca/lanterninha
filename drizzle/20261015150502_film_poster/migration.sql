CREATE TABLE `film_poster` (
	`film_id` text PRIMARY KEY,
	`content_type` text NOT NULL,
	`data` blob NOT NULL,
	CONSTRAINT `fk_film_poster_film_id_film_id_fk` FOREIGN KEY (`film_id`) REFERENCES `film`(`id`) ON DELETE CASCADE
);
