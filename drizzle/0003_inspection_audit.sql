ALTER TABLE `inspections` ADD `reviewer_user_id` text;
--> statement-breakpoint
ALTER TABLE `inspections` ADD `finalized_at` text;
--> statement-breakpoint
CREATE INDEX `idx_inspections_finalized_at` ON `inspections` (`finalized_at`);
--> statement-breakpoint
CREATE TABLE `inspection_result_events` (
	`id` text PRIMARY KEY NOT NULL,
	`inspection_id` text NOT NULL,
	`event_type` text NOT NULL,
	`status` text NOT NULL,
	`recorded_at` text NOT NULL,
	`actor_user_id` text,
	`actor_display_name` text NOT NULL,
	FOREIGN KEY (`inspection_id`) REFERENCES `inspections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_inspection_result_events_inspection_at` ON `inspection_result_events` (`inspection_id`, `recorded_at`);
