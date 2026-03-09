ALTER TABLE `accounts` MODIFY COLUMN `credentials` json;--> statement-breakpoint
ALTER TABLE `projects` MODIFY COLUMN `tags` json;--> statement-breakpoint
ALTER TABLE `templates` MODIFY COLUMN `variables` json;