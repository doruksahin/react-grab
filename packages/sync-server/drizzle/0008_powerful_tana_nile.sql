CREATE TABLE `jira_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`site_url` text NOT NULL,
	`email` text NOT NULL,
	`atlassian_account_id` text NOT NULL,
	`display_name` text NOT NULL,
	`credential_kind` text NOT NULL,
	`credential_ciphertext` text NOT NULL,
	`credential_iv` text NOT NULL,
	`key_version` text NOT NULL,
	`created_at` real NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jira_accounts_site_user_idx` ON `jira_accounts` (`site_url`,`atlassian_account_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`jira_account_id` text,
	`jira_project_key` text,
	`created_at` real NOT NULL,
	FOREIGN KEY (`jira_account_id`) REFERENCES `jira_accounts`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
ALTER TABLE `groups` ADD `jira_account_id` text REFERENCES jira_accounts(id);--> statement-breakpoint
-- Workspaces existed only as workspace_id on groups and comments until now (ADR-0027).
INSERT OR IGNORE INTO `workspaces` (`id`, `created_at`)
SELECT `workspace_id`, CAST(strftime('%s', 'now') AS REAL) * 1000 FROM `groups`
UNION
SELECT `workspace_id`, CAST(strftime('%s', 'now') AS REAL) * 1000 FROM `comments`;
