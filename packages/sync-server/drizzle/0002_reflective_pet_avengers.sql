PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_comments` (
	`id` text NOT NULL,
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
	`captured_by` text,
	PRIMARY KEY(`id`, `workspace_id`)
);
--> statement-breakpoint
INSERT INTO `__new_comments`("id", "workspace_id", "group_id", "content", "element_name", "tag_name", "component_name", "elements_count", "element_selectors", "comment_text", "timestamp", "revealed", "status", "page_url", "page_title", "screenshot_full_page", "screenshot_element", "jira_ticket_id", "captured_by") SELECT "id", "workspace_id", "group_id", "content", "element_name", "tag_name", "component_name", "elements_count", "element_selectors", "comment_text", "timestamp", "revealed", "status", "page_url", "page_title", "screenshot_full_page", "screenshot_element", "jira_ticket_id", "captured_by" FROM `comments`;--> statement-breakpoint
DROP TABLE `comments`;--> statement-breakpoint
ALTER TABLE `__new_comments` RENAME TO `comments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `comments_workspace_id_idx` ON `comments` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `__new_groups` (
	`id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` real NOT NULL,
	`revealed` integer NOT NULL,
	PRIMARY KEY(`id`, `workspace_id`)
);
--> statement-breakpoint
INSERT INTO `__new_groups`("id", "workspace_id", "name", "created_at", "revealed") SELECT "id", "workspace_id", "name", "created_at", "revealed" FROM `groups`;--> statement-breakpoint
DROP TABLE `groups`;--> statement-breakpoint
ALTER TABLE `__new_groups` RENAME TO `groups`;--> statement-breakpoint
CREATE INDEX `groups_workspace_id_idx` ON `groups` (`workspace_id`);