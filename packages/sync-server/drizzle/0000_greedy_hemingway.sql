CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`group_id` text NOT NULL,
	`content` text NOT NULL,
	`element_name` text NOT NULL,
	`tag_name` text NOT NULL,
	`component_name` text,
	`elements_count` integer,
	`element_selectors` text,
	`comment_text` text,
	`timestamp` real NOT NULL,
	`revealed` integer NOT NULL,
	`status` text,
	`page_url` text,
	`page_title` text,
	`screenshot_full_page` text,
	`screenshot_element` text,
	`jira_ticket_id` text,
	`captured_by` text
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` real NOT NULL,
	`revealed` integer NOT NULL
);
