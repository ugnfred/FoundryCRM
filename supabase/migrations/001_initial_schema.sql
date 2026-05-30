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
