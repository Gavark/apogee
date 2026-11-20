CREATE TABLE `notification_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`wine_id` integer NOT NULL,
	`phase` text NOT NULL,
	`detected_at` integer NOT NULL,
	`silent` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`wine_id`) REFERENCES `wines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_log_wine_phase` ON `notification_log` (`wine_id`,`phase`);--> statement-breakpoint
CREATE INDEX `notification_log_detected_at` ON `notification_log` (`detected_at`);--> statement-breakpoint
ALTER TABLE `households` ADD `phase_scan_date` text;