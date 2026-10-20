CREATE TABLE `generation_jobs` (
	`user_id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`job_json` text NOT NULL,
	`lease_token` text DEFAULT '' NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `library_books` (
	`user_id` text NOT NULL,
	`book_id` text NOT NULL,
	`source_hash` text NOT NULL,
	`object_key` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `book_id`)
);
--> statement-breakpoint
CREATE TABLE `library_guides` (
	`user_id` text NOT NULL,
	`book_id` text NOT NULL,
	`source_hash` text NOT NULL,
	`unit_id` text NOT NULL,
	`object_key` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `book_id`, `source_hash`, `unit_id`)
);
--> statement-breakpoint
CREATE TABLE `library_state` (
	`user_id` text NOT NULL,
	`area` text NOT NULL,
	`book_id` text NOT NULL,
	`field_key` text NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `area`, `book_id`, `field_key`)
);
