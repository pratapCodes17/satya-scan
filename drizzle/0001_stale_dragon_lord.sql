CREATE TABLE `inspection_images` (
	`inspection_id` text NOT NULL,
	`part` integer NOT NULL,
	`content_type` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`inspection_id`, `part`),
	FOREIGN KEY (`inspection_id`) REFERENCES `inspections`(`id`) ON UPDATE no action ON DELETE no action
);
