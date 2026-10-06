CREATE TABLE `inspections` (
	`id` text PRIMARY KEY NOT NULL,
	`product` text NOT NULL,
	`created_at` text NOT NULL,
	`status` text NOT NULL,
	`mode` text NOT NULL,
	`record` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_inspections_created_at` ON `inspections` (`created_at`);