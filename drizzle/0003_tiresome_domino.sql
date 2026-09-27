CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`method` text NOT NULL,
	`received_at` integer NOT NULL,
	`note` text,
	`shop_id` text NOT NULL,
	`device_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `payments_invoice_idx` ON `payments` (`invoice_id`,`received_at`);
--> statement-breakpoint
-- Carry forward what earlier builds recorded on the invoice row itself. Without
-- this every already part-paid bill would read as unpaid the moment the ledger
-- became the source of truth, and the shop would chase debts it had collected.
INSERT INTO `payments` (`id`, `invoice_id`, `amount_paise`, `method`, `received_at`, `note`, `shop_id`, `device_id`, `updated_at`, `deleted_at`)
SELECT lower(hex(randomblob(16))), `id`, `paid_paise`, 'other', `issued_at`, 'Carried over from before payments were recorded one by one', `shop_id`, `device_id`, `updated_at`, NULL
FROM `invoices`
WHERE `paid_paise` > 0 AND `deleted_at` IS NULL;
