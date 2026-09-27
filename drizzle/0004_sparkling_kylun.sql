CREATE TABLE `quotation_items` (
	`id` text PRIMARY KEY NOT NULL,
	`quotation_id` text NOT NULL,
	`product_id` text,
	`name_snapshot` text NOT NULL,
	`rate_paise` integer NOT NULL,
	`tax_rate_bps` integer DEFAULT 0 NOT NULL,
	`discount_bps` integer DEFAULT 0 NOT NULL,
	`discount_paise` integer DEFAULT 0 NOT NULL,
	`quantity_amount` integer NOT NULL,
	`unit_code` text NOT NULL,
	`dimensions_json` text,
	`line_paise` integer NOT NULL,
	`shop_id` text NOT NULL,
	`device_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `quotation_items_quotation_idx` ON `quotation_items` (`quotation_id`);--> statement-breakpoint
CREATE TABLE `quotations` (
	`id` text PRIMARY KEY NOT NULL,
	`quotation_no` text NOT NULL,
	`customer_id` text,
	`issued_at` integer NOT NULL,
	`valid_until` integer NOT NULL,
	`subtotal_paise` integer NOT NULL,
	`discount_paise` integer DEFAULT 0 NOT NULL,
	`bill_discount_paise` integer DEFAULT 0 NOT NULL,
	`taxable_paise` integer NOT NULL,
	`cgst_paise` integer DEFAULT 0 NOT NULL,
	`sgst_paise` integer DEFAULT 0 NOT NULL,
	`round_off_paise` integer DEFAULT 0 NOT NULL,
	`grand_total_paise` integer NOT NULL,
	`accepted_invoice_id` text,
	`notes` text,
	`shop_id` text NOT NULL,
	`device_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `quotations_shop_issued_idx` ON `quotations` (`shop_id`,`issued_at`);