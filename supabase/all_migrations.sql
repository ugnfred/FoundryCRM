-- ============================================================
-- 001_initial_schema.sql
-- Foundry ERP — Core Schema
-- ============================================================

-- ─────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────
create type user_role as enum ('admin','sales','accounts','dispatch');
create type company_type as enum ('buyer','supplier','both');
create type quotation_status as enum ('draft','sent','accepted','lost','expired');
create type so_status as enum ('draft','confirmed','dispatched','closed','cancelled');
create type invoice_status as enum ('draft','sent','paid','partially_paid','overdue','cancelled');
create type po_status as enum ('draft','sent','partial','received','closed','cancelled');
create type txn_type as enum ('sale','purchase','grn','adjustment','opening');
create type einvoice_status as enum ('pending','generated','cancelled');

-- ─────────────────────────────────────────
-- Profiles (extends Supabase auth.users)
-- ─────────────────────────────────────────
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  email       text not null,
  role        user_role not null default 'sales',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- Master: Company Settings (our own company)
-- ─────────────────────────────────────────
create table company_settings (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  gstin           text not null,
  state_code      text not null,  -- 2-digit state code e.g. '27' for Maharashtra
  address         text,
  pan             text,
  phone           text,
  email           text,
  logo_url        text,
  cin             text,
  bank_name       text,
  bank_account    text,
  bank_ifsc       text,
  upi_id          text,
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- Master: Companies (buyers + suppliers)
-- ─────────────────────────────────────────
create table companies (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  gstin       text,
  pan         text,
  state_code  text not null,
  address     text,
  city        text,
  pincode     text,
  type        company_type not null default 'buyer',
  phone       text,
  email       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- Master: Products / Items
-- ─────────────────────────────────────────
create table products (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  description     text,
  hsn_code        text not null,
  uom             text not null default 'NOS',  -- Unit of Measure
  base_rate       numeric(14,2) not null default 0,
  gst_rate        numeric(5,2) not null default 18,  -- percentage: 5,12,18,28
  category        text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- Sequences for human-readable numbers
-- ─────────────────────────────────────────
create sequence quotation_seq start 1001;
create sequence so_seq start 2001;
create sequence invoice_seq start 3001;
create sequence po_seq start 4001;

-- ─────────────────────────────────────────
-- Sales: Quotations
-- ─────────────────────────────────────────
create table quotations (
  id            uuid primary key default uuid_generate_v4(),
  quot_no       text not null unique default ('QT-' || nextval('quotation_seq')),
  company_id    uuid not null references companies(id),
  date          date not null default current_date,
  valid_until   date,
  status        quotation_status not null default 'draft',
  notes         text,
  terms         text,
  taxable_amt   numeric(14,2) not null default 0,
  total_gst     numeric(14,2) not null default 0,
  total         numeric(14,2) not null default 0,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table quotation_items (
  id            uuid primary key default uuid_generate_v4(),
  quotation_id  uuid not null references quotations(id) on delete cascade,
  product_id    uuid references products(id),
  description   text not null,
  hsn_code      text not null,
  uom           text not null,
  qty           numeric(14,3) not null,
  rate          numeric(14,2) not null,
  amount        numeric(14,2) generated always as (qty * rate) stored,
  gst_rate      numeric(5,2) not null,
  sort_order    int not null default 0
);

-- ─────────────────────────────────────────
-- Sales: Sales Orders
-- ─────────────────────────────────────────
create table sales_orders (
  id              uuid primary key default uuid_generate_v4(),
  so_no           text not null unique default ('SO-' || nextval('so_seq')),
  quotation_id    uuid references quotations(id),
  company_id      uuid not null references companies(id),
  date            date not null default current_date,
  delivery_date   date,
  po_reference    text,  -- buyer's PO number
  status          so_status not null default 'draft',
  notes           text,
  terms           text,
  taxable_amt     numeric(14,2) not null default 0,
  total_gst       numeric(14,2) not null default 0,
  total           numeric(14,2) not null default 0,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table so_items (
  id              uuid primary key default uuid_generate_v4(),
  so_id           uuid not null references sales_orders(id) on delete cascade,
  product_id      uuid references products(id),
  description     text not null,
  hsn_code        text not null,
  uom             text not null,
  qty             numeric(14,3) not null,
  rate            numeric(14,2) not null,
  amount          numeric(14,2) generated always as (qty * rate) stored,
  gst_rate        numeric(5,2) not null,
  dispatched_qty  numeric(14,3) not null default 0,
  sort_order      int not null default 0
);

-- ─────────────────────────────────────────
-- Sales: Invoices
-- ─────────────────────────────────────────
create table invoices (
  id                uuid primary key default uuid_generate_v4(),
  inv_no            text not null unique default ('INV-' || nextval('invoice_seq')),
  so_id             uuid references sales_orders(id),
  company_id        uuid not null references companies(id),
  date              date not null default current_date,
  due_date          date,
  place_of_supply   text not null,  -- 2-digit state code
  -- GST breakdown (intra = CGST+SGST, inter = IGST)
  taxable_amt       numeric(14,2) not null default 0,
  cgst              numeric(14,2) not null default 0,
  sgst              numeric(14,2) not null default 0,
  igst              numeric(14,2) not null default 0,
  total             numeric(14,2) not null default 0,
  amount_paid       numeric(14,2) not null default 0,
  balance_due       numeric(14,2) generated always as (total - amount_paid) stored,
  status            invoice_status not null default 'draft',
  notes             text,
  irn               text,   -- E-Invoice Reference Number
  ewb_no            text,   -- E-Way Bill Number
  created_by        uuid references profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table invoice_items (
  id            uuid primary key default uuid_generate_v4(),
  invoice_id    uuid not null references invoices(id) on delete cascade,
  product_id    uuid references products(id),
  description   text not null,
  hsn_code      text not null,
  uom           text not null,
  qty           numeric(14,3) not null,
  rate          numeric(14,2) not null,
  amount        numeric(14,2) generated always as (qty * rate) stored,
  gst_rate      numeric(5,2) not null,
  cgst_amt      numeric(14,2) not null default 0,
  sgst_amt      numeric(14,2) not null default 0,
  igst_amt      numeric(14,2) not null default 0,
  sort_order    int not null default 0
);

create table payments (
  id            uuid primary key default uuid_generate_v4(),
  invoice_id    uuid not null references invoices(id),
  amount        numeric(14,2) not null,
  date          date not null default current_date,
  mode          text not null default 'bank_transfer',  -- cash, cheque, bank_transfer, upi
  reference     text,
  notes         text,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- Purchase: Purchase Orders
-- ─────────────────────────────────────────
create table purchase_orders (
  id              uuid primary key default uuid_generate_v4(),
  po_no           text not null unique default ('PO-' || nextval('po_seq')),
  company_id      uuid not null references companies(id),
  date            date not null default current_date,
  delivery_date   date,
  status          po_status not null default 'draft',
  notes           text,
  terms           text,
  taxable_amt     numeric(14,2) not null default 0,
  total_gst       numeric(14,2) not null default 0,
  total           numeric(14,2) not null default 0,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table po_items (
  id              uuid primary key default uuid_generate_v4(),
  po_id           uuid not null references purchase_orders(id) on delete cascade,
  product_id      uuid references products(id),
  description     text not null,
  hsn_code        text not null,
  uom             text not null,
  qty             numeric(14,3) not null,
  rate            numeric(14,2) not null,
  amount          numeric(14,2) generated always as (qty * rate) stored,
  gst_rate        numeric(5,2) not null,
  received_qty    numeric(14,3) not null default 0,
  sort_order      int not null default 0
);

-- ─────────────────────────────────────────
-- Purchase: Goods Receipt Note (GRN)
-- ─────────────────────────────────────────
create table grn (
  id              uuid primary key default uuid_generate_v4(),
  grn_no          text not null unique,
  po_id           uuid not null references purchase_orders(id),
  received_date   date not null default current_date,
  notes           text,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now()
);

create table grn_items (
  id              uuid primary key default uuid_generate_v4(),
  grn_id          uuid not null references grn(id) on delete cascade,
  po_item_id      uuid not null references po_items(id),
  product_id      uuid not null references products(id),
  qty_received    numeric(14,3) not null,
  rate            numeric(14,2) not null
);

-- ─────────────────────────────────────────
-- Inventory: Stock Ledger
-- ─────────────────────────────────────────
create table stock_ledger (
  id          uuid primary key default uuid_generate_v4(),
  product_id  uuid not null references products(id),
  date        date not null default current_date,
  txn_type    txn_type not null,
  qty         numeric(14,3) not null,  -- positive = in, negative = out
  ref_id      uuid,    -- invoice_id / grn_id / etc.
  ref_type    text,    -- 'invoice', 'grn', 'adjustment'
  notes       text,
  balance     numeric(14,3) not null,  -- running balance (maintained by trigger)
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- E-Invoice Logs
-- ─────────────────────────────────────────
create table einvoice_log (
  id              uuid primary key default uuid_generate_v4(),
  invoice_id      uuid not null references invoices(id),
  irn             text unique,
  ack_no          text,
  ack_date        timestamptz,
  signed_invoice  text,
  qr_code         text,
  status          einvoice_status not null default 'pending',
  error_details   jsonb,
  created_at      timestamptz not null default now()
);

create table ewaybill_log (
  id              uuid primary key default uuid_generate_v4(),
  invoice_id      uuid not null references invoices(id),
  ewb_no          text unique,
  valid_upto      timestamptz,
  vehicle_no      text,
  transporter_id  text,
  distance_km     int,
  mode_of_trans   text default 'road',
  status          text default 'active',
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────
create index idx_quotations_company on quotations(company_id);
create index idx_quotations_status on quotations(status);
create index idx_sales_orders_company on sales_orders(company_id);
create index idx_sales_orders_status on sales_orders(status);
create index idx_invoices_company on invoices(company_id);
create index idx_invoices_status on invoices(status);
create index idx_invoices_date on invoices(date);
create index idx_purchase_orders_company on purchase_orders(company_id);
create index idx_stock_ledger_product on stock_ledger(product_id);
create index idx_stock_ledger_date on stock_ledger(date);

-- ─────────────────────────────────────────
-- updated_at trigger function
-- ─────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();
create trigger trg_companies_updated before update on companies
  for each row execute function set_updated_at();
create trigger trg_products_updated before update on products
  for each row execute function set_updated_at();
create trigger trg_quotations_updated before update on quotations
  for each row execute function set_updated_at();
create trigger trg_sales_orders_updated before update on sales_orders
  for each row execute function set_updated_at();
create trigger trg_invoices_updated before update on invoices
  for each row execute function set_updated_at();
create trigger trg_purchase_orders_updated before update on purchase_orders
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────
-- Profile auto-create on signup
-- ─────────────────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _role user_role := 'sales';
begin
  begin
    if new.raw_user_meta_data->>'role' is not null and new.raw_user_meta_data->>'role' != '' then
      _role := (new.raw_user_meta_data->>'role')::user_role;
    end if;
  exception when others then
    _role := 'sales';
  end;

  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
    _role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
-- ============================================================
-- 002_rls_policies.sql
-- Row Level Security Policies
-- ============================================================

-- Enable RLS on all tables
alter table profiles          enable row level security;
alter table company_settings  enable row level security;
alter table companies         enable row level security;
alter table products          enable row level security;
alter table quotations        enable row level security;
alter table quotation_items   enable row level security;
alter table sales_orders      enable row level security;
alter table so_items          enable row level security;
alter table invoices          enable row level security;
alter table invoice_items     enable row level security;
alter table payments          enable row level security;
alter table purchase_orders   enable row level security;
alter table po_items          enable row level security;
alter table grn               enable row level security;
alter table grn_items         enable row level security;
alter table stock_ledger      enable row level security;
alter table einvoice_log      enable row level security;
alter table ewaybill_log      enable row level security;

-- ─────────────────────────────────────────
-- Helper: get current user role
-- ─────────────────────────────────────────
create or replace function auth_role()
returns user_role language sql stable security definer as $$
  select role from profiles where id = auth.uid();
$$;

-- ─────────────────────────────────────────
-- Profiles
-- ─────────────────────────────────────────
create policy "Users can view their own profile"
  on profiles for select using (id = auth.uid());

create policy "Admins can view all profiles"
  on profiles for select using (auth_role() = 'admin');

create policy "Admins can manage profiles"
  on profiles for all using (auth_role() = 'admin');

-- ─────────────────────────────────────────
-- Company Settings (admin only)
-- ─────────────────────────────────────────
create policy "All authenticated users can read company settings"
  on company_settings for select using (auth.role() = 'authenticated');

create policy "Only admin can modify company settings"
  on company_settings for all using (auth_role() = 'admin');

-- ─────────────────────────────────────────
-- Master Data (companies, products) — all auth users read, admin+accounts write
-- ─────────────────────────────────────────
create policy "Authenticated users read companies"
  on companies for select using (auth.role() = 'authenticated');

create policy "Admin and accounts manage companies"
  on companies for all using (auth_role() in ('admin','accounts'));

create policy "Authenticated users read products"
  on products for select using (auth.role() = 'authenticated');

create policy "Admin manages products"
  on products for all using (auth_role() in ('admin','accounts'));

-- ─────────────────────────────────────────
-- Quotations — sales + admin
-- ─────────────────────────────────────────
create policy "Sales and admin read quotations"
  on quotations for select using (auth_role() in ('admin','sales','accounts'));

create policy "Sales and admin write quotations"
  on quotations for insert with check (auth_role() in ('admin','sales'));

create policy "Sales and admin update quotations"
  on quotations for update using (auth_role() in ('admin','sales'));

create policy "Admin delete quotations"
  on quotations for delete using (auth_role() = 'admin');

create policy "Quotation items follow parent"
  on quotation_items for all using (
    exists (select 1 from quotations q where q.id = quotation_id and auth_role() in ('admin','sales','accounts'))
  );

-- ─────────────────────────────────────────
-- Sales Orders
-- ─────────────────────────────────────────
create policy "All non-dispatch read sales orders"
  on sales_orders for select using (auth_role() in ('admin','sales','accounts'));

create policy "Sales and admin write sales orders"
  on sales_orders for insert with check (auth_role() in ('admin','sales'));

create policy "Sales and admin update sales orders"
  on sales_orders for update using (auth_role() in ('admin','sales'));

create policy "SO items follow parent"
  on so_items for all using (
    exists (select 1 from sales_orders so where so.id = so_id and auth_role() in ('admin','sales','accounts'))
  );

-- ─────────────────────────────────────────
-- Invoices — admin, sales, accounts
-- ─────────────────────────────────────────
create policy "Admin sales accounts read invoices"
  on invoices for select using (auth_role() in ('admin','sales','accounts'));

create policy "Admin sales accounts write invoices"
  on invoices for insert with check (auth_role() in ('admin','sales','accounts'));

create policy "Admin sales accounts update invoices"
  on invoices for update using (auth_role() in ('admin','sales','accounts'));

create policy "Invoice items follow parent"
  on invoice_items for all using (
    exists (select 1 from invoices i where i.id = invoice_id and auth_role() in ('admin','sales','accounts'))
  );

-- ─────────────────────────────────────────
-- Payments — admin + accounts
-- ─────────────────────────────────────────
create policy "Admin and accounts manage payments"
  on payments for all using (auth_role() in ('admin','accounts'));

create policy "Sales can view payments"
  on payments for select using (auth_role() = 'sales');

-- ─────────────────────────────────────────
-- Purchase Orders — admin + accounts
-- ─────────────────────────────────────────
create policy "Admin and accounts manage purchase orders"
  on purchase_orders for all using (auth_role() in ('admin','accounts'));

create policy "PO items follow parent"
  on po_items for all using (
    exists (select 1 from purchase_orders po where po.id = po_id and auth_role() in ('admin','accounts'))
  );

create policy "Admin and accounts manage GRN"
  on grn for all using (auth_role() in ('admin','accounts'));

create policy "GRN items follow parent"
  on grn_items for all using (
    exists (select 1 from grn g where g.id = grn_id and auth_role() in ('admin','accounts'))
  );

-- ─────────────────────────────────────────
-- Stock Ledger — read all auth, write system only (via service role)
-- ─────────────────────────────────────────
create policy "All authenticated read stock"
  on stock_ledger for select using (auth.role() = 'authenticated');

create policy "Admin can adjust stock"
  on stock_ledger for insert with check (auth_role() = 'admin');

-- ─────────────────────────────────────────
-- E-Invoice — admin + accounts
-- ─────────────────────────────────────────
create policy "Admin and accounts manage einvoice"
  on einvoice_log for all using (auth_role() in ('admin','accounts'));

create policy "Admin and accounts manage ewaybill"
  on ewaybill_log for all using (auth_role() in ('admin','accounts'));
-- Create company-assets storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow authenticated users to upload
DO $$ BEGIN
  CREATE POLICY "Authenticated users can upload company assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-assets');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow authenticated users to update
DO $$ BEGIN
  CREATE POLICY "Authenticated users can update company assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'company-assets');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow public read
DO $$ BEGIN
  CREATE POLICY "Public can read company assets"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'company-assets');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- ERP-102: GRN sequential numbering
-- Replaces random 6-digit GRN numbers with sequential GRN-XXXX series

CREATE SEQUENCE IF NOT EXISTS grn_seq START 9001;

-- Add grn_no column if it doesn't already have a proper one
-- (existing grn_no may be random; we keep it for legacy rows)
ALTER TABLE grn ADD COLUMN IF NOT EXISTS grn_no_seq TEXT;

-- Trigger: auto-assign sequential grn_no on new inserts
CREATE OR REPLACE FUNCTION set_grn_no()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.grn_no IS NULL OR NEW.grn_no = '' THEN
    NEW.grn_no := 'GRN-' || nextval('grn_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS grn_no_trigger ON grn;
CREATE TRIGGER grn_no_trigger
  BEFORE INSERT ON grn
  FOR EACH ROW EXECUTE FUNCTION set_grn_no();
-- ERP-106: NIC e-invoice environment toggle
-- Adds einvoice_env column to company_settings

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS einvoice_env TEXT NOT NULL DEFAULT 'sandbox'
  CHECK (einvoice_env IN ('sandbox', 'production'));
-- ERP-107/108: User management — is_active flag on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
-- ERP-201: Credit Notes module

CREATE SEQUENCE cn_seq START 5001;

CREATE TABLE credit_notes (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cn_no         TEXT          NOT NULL UNIQUE DEFAULT 'CN-' || nextval('cn_seq'),
  invoice_id    UUID          REFERENCES invoices(id) ON DELETE SET NULL,
  company_id    UUID          NOT NULL REFERENCES companies(id),
  date          DATE          NOT NULL,
  reason        TEXT,
  place_of_supply TEXT        NOT NULL DEFAULT '27',
  taxable_amt   NUMERIC(12,2) NOT NULL DEFAULT 0,
  cgst_amt      NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst_amt      NUMERIC(12,2) NOT NULL DEFAULT 0,
  igst_amt      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_gst     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  status        TEXT          NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'issued', 'cancelled')),
  created_by    UUID          REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE credit_note_items (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cn_id         UUID          NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  product_id    UUID          REFERENCES products(id),
  description   TEXT          NOT NULL,
  hsn_code      TEXT,
  uom           TEXT,
  qty           NUMERIC(10,3) NOT NULL,
  rate          NUMERIC(12,2) NOT NULL,
  gst_rate      NUMERIC(5,2)  NOT NULL DEFAULT 0,
  taxable_amt   NUMERIC(12,2) NOT NULL DEFAULT 0,
  cgst_amt      NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst_amt      NUMERIC(12,2) NOT NULL DEFAULT 0,
  igst_amt      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order    INT           DEFAULT 0
);

ALTER TABLE credit_notes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_note_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_cn"       ON credit_notes      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_cn_items" ON credit_note_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- ERP-207: Customer Ledger — append-only event table

CREATE TABLE customer_ledger (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID          NOT NULL REFERENCES companies(id),
  doc_type    TEXT          NOT NULL
              CHECK (doc_type IN ('invoice','payment','cn','advance','opening','adjustment')),
  doc_id      UUID,
  doc_no      TEXT,
  doc_date    DATE,
  debit       NUMERIC(12,2) NOT NULL DEFAULT 0,
  credit      NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes       TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledger_company_date ON customer_ledger(company_id, doc_date);

-- Backfill existing invoices as debit entries (exclude cancelled)
INSERT INTO customer_ledger (company_id, doc_type, doc_id, doc_no, doc_date, debit)
SELECT company_id, 'invoice', id, inv_no, date, total
FROM invoices
WHERE status NOT IN ('cancelled');

-- Backfill existing payments as credit entries
INSERT INTO customer_ledger (company_id, doc_type, doc_id, doc_date, credit)
SELECT i.company_id, 'payment', p.id, p.date, p.amount
FROM payments p
JOIN invoices i ON i.id = p.invoice_id;

ALTER TABLE customer_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_ledger" ON customer_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- ERP-401: Proforma Invoice schema
-- PI-7001 series, no stock/tax effect, convertible to invoice

CREATE SEQUENCE IF NOT EXISTS pi_seq START 7001;

CREATE TABLE IF NOT EXISTS proforma_invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pi_no           TEXT NOT NULL DEFAULT 'PI-' || nextval('pi_seq'),
  company_id      UUID NOT NULL REFERENCES companies(id),
  so_id           UUID REFERENCES sales_orders(id),
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  validity_date   DATE,
  place_of_supply TEXT NOT NULL DEFAULT '27',
  taxable_amt     NUMERIC(12,2) NOT NULL DEFAULT 0,
  cgst            NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst            NUMERIC(12,2) NOT NULL DEFAULT 0,
  igst            NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','converted','cancelled')),
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proforma_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pi_id       UUID NOT NULL REFERENCES proforma_invoices(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id),
  description TEXT NOT NULL,
  hsn_code    TEXT,
  uom         TEXT DEFAULT 'NOS',
  qty         NUMERIC(12,3) NOT NULL DEFAULT 1,
  rate        NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_rate    NUMERIC(5,2) NOT NULL DEFAULT 18,
  cgst_amt    NUMERIC(12,2) NOT NULL DEFAULT 0,
  sgst_amt    NUMERIC(12,2) NOT NULL DEFAULT 0,
  igst_amt    NUMERIC(12,2) NOT NULL DEFAULT 0
);

-- RLS
ALTER TABLE proforma_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE proforma_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read proforma" ON proforma_invoices FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write proforma" ON proforma_invoices FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read proforma items" ON proforma_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write proforma items" ON proforma_items FOR ALL USING (auth.role() = 'authenticated');
-- ERP-404: Delivery Challan schema
-- DC-8001 series, no price/GST columns, delivery-only document

CREATE SEQUENCE IF NOT EXISTS dc_seq START 8001;

CREATE TABLE IF NOT EXISTS delivery_challans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dc_no            TEXT NOT NULL DEFAULT 'DC-' || nextval('dc_seq'),
  company_id       UUID NOT NULL REFERENCES companies(id),
  so_id            UUID REFERENCES sales_orders(id),
  date             DATE NOT NULL DEFAULT CURRENT_DATE,
  vehicle_no       TEXT,
  transporter_name TEXT,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','dispatched','cancelled')),
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dc_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dc_id       UUID NOT NULL REFERENCES delivery_challans(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id),
  description TEXT NOT NULL,
  hsn_code    TEXT,
  uom         TEXT DEFAULT 'NOS',
  qty         NUMERIC(12,3) NOT NULL DEFAULT 1
);

-- RLS
ALTER TABLE delivery_challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE dc_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read dc" ON delivery_challans FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write dc" ON delivery_challans FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read dc items" ON dc_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write dc items" ON dc_items FOR ALL USING (auth.role() = 'authenticated');
-- ERP-501: Advance Receipts schema
-- AR-6001 series; PDC support; auto-posts to customer_ledger

CREATE SEQUENCE IF NOT EXISTS ar_seq START 6001;

CREATE TABLE IF NOT EXISTS advance_receipts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ar_no        TEXT NOT NULL DEFAULT 'AR-' || nextval('ar_seq'),
  company_id   UUID NOT NULL REFERENCES companies(id),
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_mode TEXT NOT NULL DEFAULT 'bank_transfer',
  reference    TEXT,
  notes        TEXT,
  is_pdc       BOOLEAN NOT NULL DEFAULT false,
  pdc_date     DATE,
  status       TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','applied','cancelled')),
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE advance_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read ar" ON advance_receipts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write ar" ON advance_receipts FOR ALL USING (auth.role() = 'authenticated');
-- ERP-506: Bill of Materials schema
-- bom_headers + bom_items; versioning via version INT + is_active flag

CREATE TABLE IF NOT EXISTS bom_headers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES products(id),
  version     INT NOT NULL DEFAULT 1,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  notes       TEXT,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (product_id, version)
);

CREATE TABLE IF NOT EXISTS bom_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id        UUID NOT NULL REFERENCES bom_headers(id) ON DELETE CASCADE,
  component_id  UUID NOT NULL REFERENCES products(id),
  qty           NUMERIC(12,3) NOT NULL DEFAULT 1,
  uom           TEXT NOT NULL DEFAULT 'NOS',
  notes         TEXT
);

ALTER TABLE bom_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read bom" ON bom_headers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write bom" ON bom_headers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read bom items" ON bom_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write bom items" ON bom_items FOR ALL USING (auth.role() = 'authenticated');
-- ERP-601: Work Orders schema
-- WO-1001 series; links to SO + BOM; drives stock deduction on completion

CREATE SEQUENCE IF NOT EXISTS wo_seq START 1001;

CREATE TABLE IF NOT EXISTS work_orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_no       TEXT NOT NULL DEFAULT 'WO-' || nextval('wo_seq'),
  so_id       UUID REFERENCES sales_orders(id),
  product_id  UUID NOT NULL REFERENCES products(id),
  bom_id      UUID REFERENCES bom_headers(id),
  qty         NUMERIC(12,3) NOT NULL DEFAULT 1,
  start_date  DATE,
  target_date DATE,
  assigned_to UUID REFERENCES auth.users(id),
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','done','cancelled')),
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read wo" ON work_orders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write wo" ON work_orders FOR ALL USING (auth.role() = 'authenticated');
