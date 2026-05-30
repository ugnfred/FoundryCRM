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
