CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`active` integer NOT NULL DEFAULT 1,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_sessions_token_hash` ON `user_sessions` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `idx_user_sessions_expires_at` ON `user_sessions` (`expires_at`);
--> statement-breakpoint
ALTER TABLE `inspections` ADD `owner_user_id` text;
--> statement-breakpoint
ALTER TABLE `inspections` ADD `created_by_user_id` text;
--> statement-breakpoint
CREATE INDEX `idx_inspections_owner_created_at` ON `inspections` (`owner_user_id`, `created_at`);
