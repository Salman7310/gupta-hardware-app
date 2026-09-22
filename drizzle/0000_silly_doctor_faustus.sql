CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`address` text,
	`gstin` text,
	`shop_id` text NOT NULL,
	`device_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `customers_shop_name_idx` ON `customers` (`shop_id`,`name`);--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`product_id` text,
	`name_snapshot` text NOT NULL,
	`rate_paise` integer NOT NULL,
	`tax_rate_bps` integer DEFAULT 0 NOT NULL,
	`discount_bps` integer DEFAULT 0 NOT NULL,
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
CREATE INDEX `invoice_items_invoice_idx` ON `invoice_items` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_no` text NOT NULL,
	`customer_id` text,
	`issued_at` integer NOT NULL,
	`subtotal_paise` integer NOT NULL,
	`discount_paise` integer DEFAULT 0 NOT NULL,
	`taxable_paise` integer NOT NULL,
	`cgst_paise` integer DEFAULT 0 NOT NULL,
	`sgst_paise` integer DEFAULT 0 NOT NULL,
	`round_off_paise` integer DEFAULT 0 NOT NULL,
	`grand_total_paise` integer NOT NULL,
	`paid_paise` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`shop_id` text NOT NULL,
	`device_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `invoices_shop_issued_idx` ON `invoices` (`shop_id`,`issued_at`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`unit_code` text NOT NULL,
	`sale_price_paise` integer NOT NULL,
	`purchase_price_paise` integer DEFAULT 0 NOT NULL,
	`tax_rate_bps` integer DEFAULT 0 NOT NULL,
	`hsn_code` text,
	`is_active` integer DEFAULT true NOT NULL,
	`shop_id` text NOT NULL,
	`device_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `products_shop_name_idx` ON `products` (`shop_id`,`name`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`shop_id` text NOT NULL,
	`device_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`kind` text NOT NULL,
	`quantity_amount` integer NOT NULL,
	`unit_code` text NOT NULL,
	`ref_invoice_id` text,
	`occurred_at` integer NOT NULL,
	`note` text,
	`shop_id` text NOT NULL,
	`device_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `stock_movements_product_idx` ON `stock_movements` (`product_id`,`occurred_at`);