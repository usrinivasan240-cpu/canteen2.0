-- Schema creation for new project
CREATE TABLE IF NOT EXISTS "canteens" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "college_id" text NOT NULL,
  "owner_id" text DEFAULT ''::text,
  "owner_name" text DEFAULT ''::text,
  "status" text DEFAULT 'active'::text,
  "location" text DEFAULT ''::text,
  "logo_url" text DEFAULT ''::text
);

ALTER TABLE "canteens" ADD CONSTRAINT "canteens_pkey" PRIMARY KEY ("id");

CREATE INDEX idx_canteens_college ON public.canteens USING btree (college_id);

CREATE TABLE IF NOT EXISTS "colleges" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "location" text DEFAULT ''::text,
  "logo_url" text DEFAULT ''::text,
  "banner_url" text DEFAULT ''::text,
  "banner_subtitle" text DEFAULT ''::text,
  "banner_features" jsonb DEFAULT '[]'::jsonb,
  "branding" jsonb DEFAULT '{}'::jsonb,
  "status" text DEFAULT 'active'::text,
  "updated_at" text DEFAULT ''::text,
  "platform_fee" numeric(10, 2) DEFAULT 0
);

ALTER TABLE "colleges" ADD CONSTRAINT "colleges_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "fcm_tokens" (
  "id" text NOT NULL,
  "user_id" text NOT NULL,
  "fcm_token" text NOT NULL,
  "updated_at" text NOT NULL
);

ALTER TABLE "fcm_tokens" ADD CONSTRAINT "fcm_tokens_pkey" PRIMARY KEY ("id");

CREATE INDEX idx_fcm_tokens_user_id ON public.fcm_tokens USING btree (user_id);

CREATE TABLE IF NOT EXISTS "ingredients" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "stock_grams" real DEFAULT 0,
  "unit" text DEFAULT 'g'::text,
  "canteen_id" text DEFAULT ''::text,
  "sub_canteen_id" text DEFAULT ''::text
);

ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id");

CREATE INDEX idx_ingredients_canteen ON public.ingredients USING btree (canteen_id);

CREATE TABLE IF NOT EXISTS "items" (
  "id" text NOT NULL,
  "canteen_id" text NOT NULL,
  "name" text NOT NULL,
  "price" real NOT NULL DEFAULT 0,
  "stock" integer DEFAULT 0,
  "rating" real DEFAULT 0,
  "rating_count" integer DEFAULT 0,
  "available" boolean DEFAULT true,
  "category" text DEFAULT ''::text,
  "description" text DEFAULT ''::text,
  "image_url" text DEFAULT ''::text,
  "tags" jsonb DEFAULT '[]'::jsonb,
  "prep_time" integer DEFAULT 15,
  "daily_limit" integer DEFAULT 100,
  "booked_today" integer DEFAULT 0,
  "is_paused" boolean DEFAULT false,
  "recipe" jsonb DEFAULT '[]'::jsonb,
  "sub_canteen_id" text DEFAULT ''::text,
  "college_id" text DEFAULT ''::text,
  "requires_chef" boolean DEFAULT true
);

ALTER TABLE "items" ADD CONSTRAINT "items_pkey" PRIMARY KEY ("id");

CREATE INDEX idx_items_canteen ON public.items USING btree (canteen_id);
CREATE INDEX idx_items_subcanteen ON public.items USING btree (sub_canteen_id);
CREATE INDEX idx_items_canteen_available ON public.items USING btree (canteen_id, available);
CREATE INDEX idx_items_canteen_category ON public.items USING btree (canteen_id, category);

CREATE TABLE IF NOT EXISTS "offers" (
  "id" text NOT NULL,
  "title" text NOT NULL,
  "description" text DEFAULT ''::text,
  "offer_type" text NOT NULL DEFAULT 'discount'::text,
  "discount_percent" real DEFAULT 0,
  "discount_amount" real DEFAULT 0,
  "combo_price" real DEFAULT 0,
  "combo_item_ids" ARRAY DEFAULT '{}'::text[],
  "applicable_item_ids" ARRAY DEFAULT '{}'::text[],
  "min_order_amount" real DEFAULT 0,
  "max_uses" integer DEFAULT 0,
  "used_count" integer DEFAULT 0,
  "valid_from" bigint DEFAULT 0,
  "valid_until" bigint DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "canteen_id" text DEFAULT 'canteen_001'::text,
  "created_at" bigint DEFAULT 0
);

ALTER TABLE "offers" ADD CONSTRAINT "offers_pkey" PRIMARY KEY ("id");

CREATE INDEX idx_offers_canteen ON public.offers USING btree (canteen_id);
CREATE INDEX idx_offers_active ON public.offers USING btree (is_active);

CREATE TABLE IF NOT EXISTS "orders" (
  "id" text NOT NULL,
  "user_id" text DEFAULT ''::text,
  "user_name" text DEFAULT ''::text,
  "items" jsonb DEFAULT '[]'::jsonb,
  "total_price" real DEFAULT 0,
  "payment_status" text DEFAULT 'pending'::text,
  "payment_method" text DEFAULT ''::text,
  "status" text DEFAULT 'pending'::text,
  "qr_code" text DEFAULT ''::text,
  "qr_payload" text DEFAULT ''::text,
  "timestamp" text DEFAULT ''::text,
  "created_at" bigint DEFAULT 0,
  "pickup_time_text" text DEFAULT ''::text,
  "pickup_slot" text DEFAULT ''::text,
  "prep_start_time" bigint DEFAULT 0,
  "expiry_time" bigint DEFAULT 0,
  "canteen_id" text DEFAULT ''::text,
  "sub_canteen_id" text DEFAULT ''::text,
  "college_id" text DEFAULT ''::text,
  "razorpay_order_id" text DEFAULT ''::text,
  "razorpay_payment_id" text DEFAULT ''::text,
  "razorpay_signature" text DEFAULT ''::text,
  "vyapar_txn_id" text DEFAULT ''::text,
  "upi_qr_url" text DEFAULT ''::text,
  "upi_string" text DEFAULT ''::text,
  "type" text DEFAULT ''::text,
  "bill_number" text DEFAULT ''::text,
  "customer_name" text DEFAULT ''::text,
  "customer_email" text DEFAULT ''::text,
  "customer_reg_no" text DEFAULT ''::text,
  "grand_total" real DEFAULT 0
);

ALTER TABLE "orders" ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");

CREATE INDEX idx_orders_canteen ON public.orders USING btree (canteen_id);
CREATE INDEX idx_orders_user ON public.orders USING btree (user_id);
CREATE INDEX idx_orders_status ON public.orders USING btree (status);
CREATE INDEX idx_orders_created ON public.orders USING btree (created_at);
CREATE INDEX idx_orders_canteen_created ON public.orders USING btree (canteen_id, created_at DESC);
CREATE INDEX idx_orders_user_created ON public.orders USING btree (user_id, created_at DESC);
CREATE INDEX idx_orders_slot_canteen_status ON public.orders USING btree (pickup_slot, canteen_id, status);
CREATE INDEX idx_orders_payment_status ON public.orders USING btree (payment_status);

CREATE TABLE IF NOT EXISTS "otp_store" (
  "email" text NOT NULL,
  "code" text NOT NULL,
  "expires_at" bigint NOT NULL,
  "created_at" bigint DEFAULT 0
);

ALTER TABLE "otp_store" ADD CONSTRAINT "otp_store_pkey" PRIMARY KEY ("email");

CREATE TABLE IF NOT EXISTS "reviews" (
  "id" text NOT NULL,
  "user_id" text DEFAULT ''::text,
  "user_name" text DEFAULT ''::text,
  "rating" integer DEFAULT 0,
  "comment" text DEFAULT ''::text,
  "sentiment" text DEFAULT 'neutral'::text,
  "timestamp" text DEFAULT ''::text,
  "menu_item_id" text DEFAULT ''::text,
  "menu_item_name" text DEFAULT ''::text,
  "canteen_id" text DEFAULT ''::text,
  "sub_canteen_id" text DEFAULT ''::text
);

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");

CREATE INDEX idx_reviews_canteen ON public.reviews USING btree (canteen_id);
CREATE INDEX idx_reviews_canteen_rating ON public.reviews USING btree (canteen_id, rating);

CREATE TABLE IF NOT EXISTS "settings" (
  "canteen_id" text NOT NULL,
  "no_show_minutes" integer DEFAULT 30,
  "default_slot_capacity" integer DEFAULT 30
);

ALTER TABLE "settings" ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("canteen_id");

CREATE TABLE IF NOT EXISTS "subcanteens" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "canteen_id" text NOT NULL,
  "status" text DEFAULT 'active'::text
);

ALTER TABLE "subcanteens" ADD CONSTRAINT "subcanteens_pkey" PRIMARY KEY ("id");

CREATE INDEX idx_subcanteens_canteen ON public.subcanteens USING btree (canteen_id);

CREATE TABLE IF NOT EXISTS "support_tickets" (
  "id" text NOT NULL,
  "user_id" text NOT NULL,
  "user_name" text NOT NULL,
  "user_email" text NOT NULL,
  "category" text DEFAULT 'other'::text,
  "subject" text DEFAULT ''::text,
  "description" text DEFAULT ''::text,
  "order_id" text DEFAULT ''::text,
  "status" text DEFAULT 'open'::text,
  "priority" text DEFAULT 'medium'::text,
  "created_at" bigint DEFAULT 0,
  "updated_at" bigint DEFAULT 0,
  "admin_reply" text DEFAULT ''::text,
  "canteen_id" text DEFAULT ''::text,
  "college_id" text DEFAULT ''::text
);

ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id");

CREATE INDEX idx_support_tickets_user ON public.support_tickets USING btree (user_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets USING btree (status);
CREATE INDEX idx_support_tickets_canteen_status ON public.support_tickets USING btree (canteen_id, status);

CREATE TABLE IF NOT EXISTS "users" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "password" text NOT NULL,
  "role" text DEFAULT 'customer'::text,
  "phone" text DEFAULT ''::text,
  "register_number" text DEFAULT ''::text,
  "college_id" text DEFAULT ''::text,
  "canteen_id" text DEFAULT ''::text,
  "sub_canteen_id" text DEFAULT ''::text,
  "status" text DEFAULT 'active'::text,
  "posting" text DEFAULT ''::text,
  "created_at" bigint DEFAULT 0
);

ALTER TABLE "users" ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);
CREATE INDEX idx_users_canteen ON public.users USING btree (canteen_id);
CREATE INDEX idx_users_college ON public.users USING btree (college_id);
CREATE INDEX idx_users_role ON public.users USING btree (role);
CREATE INDEX idx_users_college_role ON public.users USING btree (college_id, role);

CREATE TABLE IF NOT EXISTS "walkin_bills" (
  "id" text NOT NULL,
  "bill_number" text NOT NULL,
  "items" jsonb DEFAULT '[]'::jsonb,
  "subtotal" real DEFAULT 0,
  "discount" real DEFAULT 0,
  "tax" real DEFAULT 0,
  "grand_total" real DEFAULT 0,
  "payment_status" text DEFAULT 'pending'::text,
  "payment_method" text DEFAULT ''::text,
  "customer_name" text DEFAULT ''::text,
  "customer_phone" text DEFAULT ''::text,
  "customer_reg_no" text DEFAULT ''::text,
  "customer_dept" text DEFAULT ''::text,
  "customer_notes" text DEFAULT ''::text,
  "pending_reason" text DEFAULT ''::text,
  "pending_expected_time" text DEFAULT ''::text,
  "cashier_name" text DEFAULT ''::text,
  "canteen_id" text DEFAULT ''::text,
  "sub_canteen_id" text DEFAULT ''::text,
  "college_id" text DEFAULT ''::text,
  "timestamp" text DEFAULT ''::text,
  "created_at" bigint DEFAULT 0,
  "synced" boolean DEFAULT false,
  "type" text DEFAULT 'walkin'::text,
  "status" text DEFAULT ''::text
);

ALTER TABLE "walkin_bills" ADD CONSTRAINT "walkin_bills_pkey" PRIMARY KEY ("id");

CREATE INDEX idx_walkin_bills_canteen ON public.walkin_bills USING btree (canteen_id);
CREATE INDEX idx_walkin_bills_canteen_created ON public.walkin_bills USING btree (canteen_id, created_at DESC);

