ALTER TABLE `invoice_items` ADD `discount_paise` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `bill_discount_paise` integer DEFAULT 0 NOT NULL;